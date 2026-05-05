from openai import OpenAI

# Point it to your local llama.cpp server
client = OpenAI(
    base_url="http://127.0.0.1:8001/v1",
    api_key="sk-no-key-required" # llama.cpp doesn't care about the key
)

print("Sending request to Qwen 3.6...")

response = client.chat.completions.create(
    model="qwen", # The model name doesn't matter for local llama.cpp
    messages=[
        {"role": "system", "content": "You are a highly capable AI assistant."},
        {"role": "user", "content": "generate me a complete e commerce website using react and go lang, it should have 40 apis in backend"}
    ],
    temperature=0.7
)

print("\n--- Output ---")
print(response.choices[0].message.content)