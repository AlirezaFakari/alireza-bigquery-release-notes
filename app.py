import time
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache
cache = {
    "data": None,
    "last_fetched": 0,
    "expiry_seconds": 600  # 10 minutes
}

NAMESPACES = {
    'atom': 'http://www.w3.org/2005/Atom'
}

def clean_text(html_content):
    """Extract clean plain text from HTML content for search indexing and tweeting."""
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, 'html.parser')
    return soup.get_text().strip()

def parse_release_notes(xml_content):
    """Parse BigQuery release notes Atom feed into a structured list of entries and sub-updates."""
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        print(f"XML Parsing Error: {e}")
        return []

    entries = []
    
    # Iterate through each <entry> in the Atom feed
    for entry_idx, entry in enumerate(root.findall('atom:entry', NAMESPACES)):
        title_el = entry.find('atom:title', NAMESPACES)
        id_el = entry.find('atom:id', NAMESPACES)
        updated_el = entry.find('atom:updated', NAMESPACES)
        content_el = entry.find('atom:content', NAMESPACES)
        
        date = title_el.text.strip() if title_el is not None else "Unknown Date"
        entry_id = id_el.text.strip() if id_el is not None else f"entry_{entry_idx}"
        updated_raw = updated_el.text.strip() if updated_el is not None else ""
        
        # Link resolution
        link = "https://cloud.google.com/bigquery/docs/release-notes"
        links = entry.findall('atom:link', NAMESPACES)
        for l in links:
            rel = l.attrib.get('rel')
            if rel == 'alternate' or not rel:
                link = l.attrib.get('href')
                break

        content_html = content_el.text if content_el is not None else ""
        
        # Parse the HTML content to extract individual updates (separated by h3 tags)
        updates = []
        if content_html:
            soup = BeautifulSoup(content_html, 'html.parser')
            
            current_type = None
            current_nodes = []
            sub_idx = 0
            
            # Iterate through the elements inside the content
            for child in soup.contents:
                # If it's a header tag (e.g. h3), it marks a new update type
                if child.name in ['h3', 'h2', 'h4']:
                    # Save the previous update if we collected text for it
                    if current_type and current_nodes:
                        html_desc = "".join(str(n) for n in current_nodes).strip()
                        txt_desc = clean_text(html_desc)
                        if txt_desc:
                            updates.append({
                                "id": f"{entry_id}_sub_{sub_idx}",
                                "type": current_type,
                                "description_html": html_desc,
                                "description_text": txt_desc
                            })
                            sub_idx += 1
                    
                    current_type = child.get_text().strip()
                    current_nodes = []
                else:
                    if current_type:
                        current_nodes.append(child)
            
            # Add the final parsed update
            if current_type and current_nodes:
                html_desc = "".join(str(n) for n in current_nodes).strip()
                txt_desc = clean_text(html_desc)
                if txt_desc:
                    updates.append({
                        "id": f"{entry_id}_sub_{sub_idx}",
                        "type": current_type,
                        "description_html": html_desc,
                        "description_text": txt_desc
                    })
            
            # Fallback if no structured headers were found
            if not updates and content_html.strip():
                txt_desc = clean_text(content_html)
                if txt_desc:
                    updates.append({
                        "id": f"{entry_id}_sub_0",
                        "type": "General",
                        "description_html": content_html,
                        "description_text": txt_desc
                    })
        
        entries.append({
            "date": date,
            "updated_raw": updated_raw,
            "link": link,
            "entry_id": entry_id,
            "updates": updates
        })
        
    return entries

def fetch_feed(force=False):
    """Fetch from external feed URL and update cache if expired or forced."""
    now = time.time()
    
    # Return cache if valid and not forced
    if not force and cache["data"] is not None and (now - cache["last_fetched"]) < cache["expiry_seconds"]:
        return cache["data"], cache["last_fetched"], False

    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        
        parsed_data = parse_release_notes(response.text)
        
        # Update cache
        cache["data"] = parsed_data
        cache["last_fetched"] = now
        return parsed_data, now, True
        
    except Exception as e:
        print(f"Error fetching feed: {e}")
        # Return cache if available as fallback, even if expired
        if cache["data"] is not None:
            return cache["data"], cache["last_fetched"], False  # Return cache but log error
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force = request.args.get('force', 'false').lower() == 'true'
    try:
        releases, last_fetched, updated = fetch_feed(force=force)
        return jsonify({
            "success": True,
            "last_fetched": last_fetched,
            "releases": releases,
            "cache_hit": not updated
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
