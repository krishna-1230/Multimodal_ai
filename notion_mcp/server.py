"""
Notion MCP Server — Enterprise Ready
======================================
Plug-and-play FastMCP server for the Notion API.

Client credentials (set in .env or MCP server config env block):
    NOTION_TOKEN    Notion Integration token (starts with ntn_ or secret_)
                    Create at: https://www.notion.so/my-integrations

MCP config example (Claude Desktop / agent framework):
    {
      "mcpServers": {
        "notion": {
          "command": "python",
          "args": ["server.py"],
          "cwd": "/path/to/notion",
          "env": { "NOTION_TOKEN": "ntn_your_token_here" }
        }
      }
    }
"""

import logging
import os
import sys
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from fastmcp import FastMCP

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  [notion-mcp]  %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config validation
# ---------------------------------------------------------------------------
NOTION_TOKEN: str = os.getenv("NOTION_TOKEN", "").strip()
if not NOTION_TOKEN:
    logger.error("NOTION_TOKEN is not set. Configure it in .env or MCP server env block.")
    sys.exit(1)

NOTION_BASE_URL = os.getenv("NOTION_BASE_URL", "https://api.notion.com")
NOTION_VERSION = os.getenv("NOTION_VERSION", "2022-06-28")

logger.info("Notion MCP Server starting — token configured OK")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
mcp = FastMCP(
    "notion",
    instructions=(
        "Notion connector. Full access to pages, databases, blocks, comments, and users. "
        "Credentials are pre-configured — just call tools directly."
    ),
)

# ---------------------------------------------------------------------------
# HTTP client helper
# ---------------------------------------------------------------------------
_HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
}


def _req(
    method: str,
    endpoint: str,
    data: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    url = f"{NOTION_BASE_URL}{endpoint}"
    with httpx.Client(timeout=30.0) as client:
        try:
            func = getattr(client, method.lower())
            kwargs: Dict[str, Any] = {"headers": _HEADERS}
            if params:
                kwargs["params"] = params
            if data is not None:
                kwargs["json"] = data
            resp = func(url, **kwargs)
            if resp.status_code >= 400:
                try:
                    return {"error": resp.json(), "status": resp.status_code}
                except Exception:
                    return {"error": resp.text, "status": resp.status_code}
            return resp.json()
        except httpx.RequestError as exc:
            raise RuntimeError(f"Notion API request failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Connectivity
# ---------------------------------------------------------------------------

@mcp.tool()
def ping() -> str:
    """Test the Notion token by fetching the bot user."""
    try:
        resp = _req("get", "/v1/users/me")
        if "error" in resp:
            return f"Notion connection failed: {resp['error']}"
        name = resp.get("name") or resp.get("bot", {}).get("owner", {}).get("workspace_name", "unknown")
        logger.info("ping: success — bot=%s", name)
        return f"Notion connection successful. Bot: {name}"
    except Exception as exc:
        return f"Notion connection failed: {exc}"


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@mcp.tool()
def get_current_user() -> Dict[str, Any]:
    """Retrieve the bot user associated with the integration token."""
    return _req("get", "/v1/users/me")


@mcp.tool()
def get_user(user_id: str) -> Dict[str, Any]:
    """
    Retrieve a user by ID.

    Args:
        user_id: Notion user UUID.
    """
    return _req("get", f"/v1/users/{user_id}")


@mcp.tool()
def list_users(page_size: int = 100, start_cursor: Optional[str] = None) -> Dict[str, Any]:
    """
    List all users in the workspace.

    Args:
        page_size: Results per page (max 100).
        start_cursor: Pagination cursor from a previous response.
    """
    params: Dict[str, Any] = {"page_size": page_size}
    if start_cursor:
        params["start_cursor"] = start_cursor
    return _req("get", "/v1/users", params=params)


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

@mcp.tool()
def search(
    query: Optional[str] = None,
    filter_type: Optional[str] = None,
    sort_direction: Optional[str] = None,
    start_cursor: Optional[str] = None,
    page_size: int = 20,
) -> Dict[str, Any]:
    """
    Search Notion pages and databases by title.

    Args:
        query: Text to search for.
        filter_type: "page" or "database" to restrict results.
        sort_direction: "ascending" or "descending" (by last_edited_time).
        start_cursor: Pagination cursor.
        page_size: Results per page (default 20, max 100).
    """
    body: Dict[str, Any] = {"page_size": page_size}
    if query:
        body["query"] = query
    if filter_type:
        body["filter"] = {"value": filter_type, "property": "object"}
    if sort_direction:
        body["sort"] = {"direction": sort_direction, "timestamp": "last_edited_time"}
    if start_cursor:
        body["start_cursor"] = start_cursor
    return _req("post", "/v1/search", body)


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

@mcp.tool()
def get_page(page_id: str) -> Dict[str, Any]:
    """
    Retrieve a page's metadata and properties.

    Args:
        page_id: Notion page UUID.
    """
    return _req("get", f"/v1/pages/{page_id}")


@mcp.tool()
def create_page(
    parent: Dict[str, Any],
    properties: Dict[str, Any],
    children: Optional[List[Dict[str, Any]]] = None,
    icon: Optional[Dict[str, Any]] = None,
    cover: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Create a new page in a database or as a child of another page.

    Args:
        parent: Parent descriptor, e.g. {"database_id": "..."} or {"page_id": "..."}.
        properties: Page property values (must match database schema if in a database).
        children: Optional list of block objects for the page body.
        icon: Optional emoji or external image icon.
        cover: Optional external image cover.
    """
    body = {"parent": parent, "properties": properties}
    if children:
        body["children"] = children
    if icon:
        body["icon"] = icon
    if cover:
        body["cover"] = cover
    logger.info("create_page: in parent %s", parent)
    return _req("post", "/v1/pages", body)


@mcp.tool()
def update_page(
    page_id: str,
    properties: Optional[Dict[str, Any]] = None,
    archived: Optional[bool] = None,
    icon: Optional[Dict[str, Any]] = None,
    cover: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Update a page's properties, archive status, icon, or cover.

    Args:
        page_id: Notion page UUID.
        properties: Updated property values.
        archived: Pass True to archive (trash) the page.
        icon: New icon.
        cover: New cover.
    """
    body: Dict[str, Any] = {}
    if properties is not None:
        body["properties"] = properties
    if archived is not None:
        body["archived"] = archived
    if icon is not None:
        body["icon"] = icon
    if cover is not None:
        body["cover"] = cover
    return _req("patch", f"/v1/pages/{page_id}", body)


@mcp.tool()
def get_page_property(
    page_id: str,
    property_id: str,
    page_size: int = 100,
    start_cursor: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Retrieve a single property item from a page.

    Args:
        page_id: Notion page UUID.
        property_id: Property ID or name.
        page_size: Results per page for paginated properties.
        start_cursor: Pagination cursor.
    """
    params: Dict[str, Any] = {"page_size": page_size}
    if start_cursor:
        params["start_cursor"] = start_cursor
    return _req("get", f"/v1/pages/{page_id}/properties/{property_id}", params=params)


# ---------------------------------------------------------------------------
# Blocks
# ---------------------------------------------------------------------------

@mcp.tool()
def get_block(block_id: str) -> Dict[str, Any]:
    """
    Retrieve a specific block.

    Args:
        block_id: Block UUID (same as page_id for page root).
    """
    return _req("get", f"/v1/blocks/{block_id}")


@mcp.tool()
def get_block_children(
    block_id: str,
    page_size: int = 100,
    start_cursor: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Retrieve the children blocks of a page or block (reads page content).

    Args:
        block_id: Parent block / page UUID.
        page_size: Results per page (max 100).
        start_cursor: Pagination cursor.
    """
    params: Dict[str, Any] = {"page_size": page_size}
    if start_cursor:
        params["start_cursor"] = start_cursor
    return _req("get", f"/v1/blocks/{block_id}/children", params=params)


@mcp.tool()
def append_block_children(
    block_id: str,
    children: List[Dict[str, Any]],
    after: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Append new blocks to a page or block.

    Args:
        block_id: Parent page or block UUID.
        children: List of block objects to append.
        after: Optional block ID to insert after.
    """
    body: Dict[str, Any] = {"children": children}
    if after:
        body["after"] = after
    logger.info("append_block_children: to block %s", block_id)
    return _req("patch", f"/v1/blocks/{block_id}/children", body)


@mcp.tool()
def update_block(block_id: str, block: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update a block's content.

    Args:
        block_id: Block UUID.
        block: Block type object with updated content (e.g. {"paragraph": {"rich_text": [...]}}).
    """
    return _req("patch", f"/v1/blocks/{block_id}", block)


@mcp.tool()
def delete_block(block_id: str) -> Dict[str, Any]:
    """
    Archive (delete) a block.

    Args:
        block_id: Block UUID.
    """
    logger.info("delete_block: %s", block_id)
    return _req("delete", f"/v1/blocks/{block_id}")


# ---------------------------------------------------------------------------
# Databases
# ---------------------------------------------------------------------------

@mcp.tool()
def get_database(database_id: str) -> Dict[str, Any]:
    """
    Retrieve a database's metadata and property schema.

    Args:
        database_id: Notion database UUID.
    """
    return _req("get", f"/v1/databases/{database_id}")


@mcp.tool()
def query_database(
    database_id: str,
    filter: Optional[Dict[str, Any]] = None,
    sorts: Optional[List[Dict[str, Any]]] = None,
    start_cursor: Optional[str] = None,
    page_size: int = 20,
) -> Dict[str, Any]:
    """
    Query a database to find pages matching a filter.

    Args:
        database_id: Notion database UUID.
        filter: Notion filter object (see API docs).
        sorts: List of sort objects.
        start_cursor: Pagination cursor.
        page_size: Results per page (default 20, max 100).
    """
    body: Dict[str, Any] = {"page_size": page_size}
    if filter:
        body["filter"] = filter
    if sorts:
        body["sorts"] = sorts
    if start_cursor:
        body["start_cursor"] = start_cursor
    return _req("post", f"/v1/databases/{database_id}/query", body)


@mcp.tool()
def create_database(
    parent: Dict[str, Any],
    properties: Dict[str, Any],
    title: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Create a new database as a child of a page.

    Args:
        parent: Parent page descriptor {"page_id": "..."}.
        properties: Database property schema.
        title: Optional rich text array for the database name.
    """
    body: Dict[str, Any] = {"parent": parent, "properties": properties}
    if title:
        body["title"] = title
    logger.info("create_database: in parent %s", parent)
    return _req("post", "/v1/databases", body)


@mcp.tool()
def update_database(
    database_id: str,
    properties: Optional[Dict[str, Any]] = None,
    title: Optional[List[Dict[str, Any]]] = None,
    description: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Update a database's title, description, or properties.

    Args:
        database_id: Notion database UUID.
        properties: Updated property schema.
        title: New rich text title.
        description: New rich text description.
    """
    body: Dict[str, Any] = {}
    if properties is not None:
        body["properties"] = properties
    if title is not None:
        body["title"] = title
    if description is not None:
        body["description"] = description
    return _req("patch", f"/v1/databases/{database_id}", body)


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------

@mcp.tool()
def get_comments(
    block_id: str,
    page_size: int = 100,
    start_cursor: Optional[str] = None,
) -> Dict[str, Any]:
    """
    List comments on a page or block.

    Args:
        block_id: Page or block UUID.
        page_size: Results per page.
        start_cursor: Pagination cursor.
    """
    params: Dict[str, Any] = {"block_id": block_id, "page_size": page_size}
    if start_cursor:
        params["start_cursor"] = start_cursor
    return _req("get", "/v1/comments", params=params)


@mcp.tool()
def create_comment(
    parent: Dict[str, Any],
    rich_text: List[Dict[str, Any]],
    discussion_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Add a comment to a page or discussion thread.

    Args:
        parent: {"page_id": "..."} for a new thread or {"discussion_id": "..."} to reply.
        rich_text: Notion rich text array for the comment body.
        discussion_id: Existing discussion thread ID (alternative to parent).
    """
    body: Dict[str, Any] = {"parent": parent, "rich_text": rich_text}
    if discussion_id:
        body["discussion_id"] = discussion_id
    logger.info("create_comment: on %s", parent)
    return _req("post", "/v1/comments", body)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.getenv("MCP_PORT", "8001"))
    logger.info("Starting Notion MCP server on port %d", port)
    mcp.run(transport="http", port=port)
