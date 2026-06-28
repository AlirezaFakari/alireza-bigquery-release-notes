# BigQuery Release Notes Tracker

A modern Flask-based web application that tracks, parses, and visualizes Google Cloud BigQuery release notes. The app fetches updates from the official Google Cloud feeds, structures individual updates by category (e.g., Features, Changes, Deprecations), and serves them through a clean web UI and a structured API.

## Features

- **Real-time Parsing:** Automatically fetches and processes Google's official BigQuery Atom release feed (`https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`).
- **Structured Categorization:** Divides complex multi-part release updates into granular, categorized sub-updates (e.g., by headers like `h3`).
- **In-Memory Caching:** Includes a 10-minute caching layer to reduce upstream traffic and improve response times.
- **RESTful API Endpoint:** Exposes a JSON endpoint at `/api/releases` supporting cache-bypassing via query parameters.
- **Clean Interface:** Beautiful dashboard displaying release notes dynamically with search/filtering capabilities.

## Architecture

The project is structured as follows:
- `app.py`: Flask application containing the feed fetcher, Atom XML parsing logic using `xml.etree.ElementTree`, and HTML cleaning using `BeautifulSoup`.
- `templates/index.html`: Responsive HTML frontend template displaying the parsed release notes.
- `static/`: Static assets (CSS/JS) for styling and interactive UI features.
- `requirements.txt`: Python package dependencies.

---

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/alireza-bigquery-release-notes.git
cd alireza-bigquery-release-notes
```

### 2. Set Up a Virtual Environment

Initialize and activate a virtual environment to manage dependencies:

```bash
# Create the environment
python3 -m venv .venv

# Activate it
# On macOS/Linux:
source .venv/bin/activate
# On Windows (cmd):
.venv\Scripts\activate.bat
```

### 3. Install Dependencies

Install the required Python packages:

```bash
pip install -r requirements.txt
```

### 4. Run the Application

Start the Flask development server:

```bash
python app.py
```

The application will start running at `http://127.0.0.1:5000/`.

---

## API Documentation

### Get Release Notes

Retrieves a structured list of BigQuery release notes.

* **URL:** `/api/releases`
* **Method:** `GET`
* **Query Parameters:**
  - `force` (optional, default: `false`): Set to `true` to bypass the in-memory cache and force-fetch the live feed.
* **Response Example (JSON):**
  ```json
  {
    "success": true,
    "cache_hit": true,
    "last_fetched": 1782782400.0,
    "releases": [
      {
        "date": "June 18, 2026",
        "entry_id": "tag:google.com,2026:bigquery-release-notes:2026-06-18",
        "link": "https://cloud.google.com/bigquery/docs/release-notes",
        "updated_raw": "2026-06-18T18:00:00Z",
        "updates": [
          {
            "id": "tag:google.com,2026:bigquery-release-notes:2026-06-18_sub_0",
            "type": "Features",
            "description_html": "<p>BigQuery now supports...</p>",
            "description_text": "BigQuery now supports..."
          }
        ]
      }
    ]
  }
  ```

---

## Technologies Used

- **Flask 3.0.3** - Light-weight Python Web Framework
- **BeautifulSoup4** - HTML Parsing and text extraction
- **Requests** - HTTP Library for fetching remote XML feeds
- **Standard Python XML Libraries** - For parsing the Atom feed
