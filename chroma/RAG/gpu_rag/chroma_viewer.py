import streamlit as st
from chromadb import PersistentClient
from collections import defaultdict

# ---------------------------
# 🎨 Streamlit Page Settings
# ---------------------------
st.set_page_config(page_title="ChromaDB Viewer", layout="wide")
st.markdown("## 🔍 ChromaDB Chunk Viewer")
st.markdown("Browse and search embedded chunks by their original document.")

# ---------------------------
# 🔌 Connect to ChromaDB
# ---------------------------
chroma_client = PersistentClient(path="chroma_db")

# ---------------------------
# 📁 Get Available Collections
# ---------------------------
collections = chroma_client.list_collections()
collection_names = [c.name for c in collections]

if not collection_names:
    st.error("❌ No collections found in your ChromaDB directory.")
    st.stop()

# ---------------------------
# 🎛️ Sidebar Options
# ---------------------------
selected_collection = st.sidebar.selectbox("📚 Select a Collection", collection_names)
limit = st.sidebar.slider("📦 Number of chunks to load", min_value=1, max_value=1000, value=100)
search_query = st.sidebar.text_input("🔍 Search within chunks", "")

# ---------------------------
# 📥 Load Collection + Chunks
# ---------------------------
collection = chroma_client.get_collection(name=selected_collection)
results = collection.get(limit=limit)

# ---------------------------
# 🗂️ Group by Document
# ---------------------------
grouped = defaultdict(list)
for i in range(len(results["documents"])):
    doc = results["documents"][i]
    meta = results["metadatas"][i]
    source = meta.get("source", "❓ Unknown")
    chunk_id = results["ids"][i]

    # Apply search filter if query is entered
    if search_query.lower() in doc.lower():
        grouped[source].append((chunk_id, doc))
    elif not search_query:
        grouped[source].append((chunk_id, doc))

# ---------------------------
# 🖼️ Display Chunks Grouped by File
# ---------------------------
if grouped:
    for source_file, chunks in grouped.items():
        st.markdown(f"### 📄 **{source_file}** — {len(chunks)} chunks")
        for chunk_id, chunk_text in chunks:
            with st.expander(f"🧩 Chunk ID: `{chunk_id}`", expanded=False):
                st.text_area("Chunk Text", chunk_text, height=200, disabled=True, label_visibility="collapsed")

        st.markdown("---")
else:
    st.warning("🔎 No chunks found matching your search.")
