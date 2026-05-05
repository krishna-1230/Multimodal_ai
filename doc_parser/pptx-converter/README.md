# HTML to PDF/PPTX Converter

This project provides a Flask-based API to convert structured JSON data into a PowerPoint presentation (`.pptx`) file. It supports adding text (paragraphs and list items) and images to slides.

## Project Structure

-   `app.py`: The main Flask application that handles the API endpoint and PowerPoint generation logic.
-   `requirements.txt`: Lists the Python dependencies required for the project.```
-   `sample.json`: A sample JSON request body demonstrating the API's input format.
-   `sample2.json`: An example of a pure text PowerPoint request, with each slide containing a heading and six paragraphs, focusing on Java and its features.
```-   `start.bat`: A Windows batch script to activate the virtual environment and run the Flask application.

## Setup and Installation

1.  **Clone the repository** (if applicable):

    ```bash
    git clone <repository_url>
    cd pptx-converter
    ```

2.  **Create a Python Virtual Environment** (if you don't have one):

    ```bash
    python -m venv venv
    ```

3.  **Activate the Virtual Environment**:

    *   **Windows (Command Prompt/PowerShell)**:

        ```bash
        .\venv\Scripts\activate.bat
        ```

4.  **Install Dependencies**:

    ```bash
    pip install -r requirements.txt
    ```

## Running the Application

To start the Flask application, you can use the provided `start.bat` script:

```bash
start.bat
```

Alternatively, you can manually activate the virtual environment and run the `app.py` file:

```bash
.\venv\Scripts\activate.bat
python app.py
```

The application will run on `http://127.0.0.1:5002`.

## API Endpoint

### `POST /convert-pptx`

This endpoint accepts a JSON payload representing the content for your PowerPoint presentation and returns a `.pptx` file.

-   **URL**: `http://127.0.0.1:5002/convert-pptx`
-   **Method**: `POST`
-   **Content-Type**: `application/json`

### Request Body Format

The request body should be a JSON object with a `slides` array. Each element in the `slides` array represents a single slide and can contain a `title` and a `content` array. The `content` array can include `paragraph`, `list_item`, and `image` types.

-   `title` (optional): The title of the slide.
-   `content`: An array of content items for the slide.
    -   **`type: "paragraph"`**:
        -   `text`: The text content of the paragraph.
    -   **`type: "list"`**:
        -   `items`: An array of strings, each representing a list item.
    -   **`type: "subtitle"`**:
        -   `text`: The text content for the subtitle.
    -   **`type: "heading"`**:
        -   `text`: The text content for the heading.
        -   `left` (optional, default: 1 inch): The left position of the heading in inches.
        -   `top` (optional, default: 1 inch): The top position of the heading in inches.
        -   `width` (optional, default: 9 inches): The width of the heading in inches.
        -   `height` (optional, default: 1 inch): The height of the heading in inches.
        -   `font_size` (optional, default: 0.3 inches): The font size of the heading in inches.
    -   **`type: "table"`**:
        -   `rows`: Number of rows in the table.
        -   `cols`: Number of columns in the table.
        -   `data`: A 2D array of strings representing the table content.
        -   `left` (optional): The left position of the table in inches.
        -   `top` (optional): The top position of the table in inches.
        -   `width` (optional): The width of the table in inches.
        -   `height` (optional): The height of the table in inches.
    -   **`type: "image"`**:
        -   `path`: The absolute path to the image file on the server where the Flask app is running.
        -   `left` (optional, default: 1 inch): The left position of the image in inches.
        -   `top` (optional, default: 1 inch): The top position of the image in inches.
        -   `width` (optional, default: 6 inches): The width of the image in inches.
        -   `height` (optional, default: 4.5 inches): The height of the image in inches.

### Example Request Body

For a detailed example, refer to the `sample.json` file in the project root. Below is a snippet:

```json
{
  "slides": [
    {
      "title": "Introduction to Java",
      "content": [
        {
          "type": "table",
          "rows": 3,
          "cols": 2,
          "data": [
            ["Feature", "Description"],
            ["Platform Independence", "Write Once, Run Anywhere"],
            ["Object-Oriented", "Encapsulation, Inheritance, Polymorphism"]
          ]
        },
        {
          "type": "heading",
          "text": "What is Java?"
        },
        {
          "type": "paragraph",
          "text": "Java is a high-level, class-based, object-oriented programming language that is designed to have as few implementation dependencies as possible."
        },
        {
          "type": "paragraph",
          "text": "It was developed by James Gosling at Sun Microsystems and released in 1995. Java is known for its 'Write Once, Run Anywhere' (WORA) principle."
        },
        {
          "type": "paragraph",
          "text": "This means that compiled Java code can run on all platforms that support Java without the need for recompilation."
        },
        {
          "type": "paragraph",
          "text": "Java applications are typically compiled to bytecode that can run on any Java Virtual Machine (JVM) regardless of the underlying computer architecture."
        },
        {
          "type": "paragraph",
          "text": "It is one of the most popular programming languages in the world, widely used for enterprise-level applications, mobile development, and big data."
        },
        {
          "type": "paragraph",
          "text": "Its robust ecosystem and extensive libraries make it a preferred choice for many developers."
        }
      ]
    },
    {
      "title": "Key Features of Java",
      "content": [
        {
          "type": "heading",
          "text": "Platform Independence"
        },
        {
          "type": "paragraph",
          "text": "Java's bytecode compilation allows it to run on any device with a JVM, ensuring platform independence."
        },
        {
          "type": "paragraph",
          "text": "This is a significant advantage over languages that require recompilation for different operating systems."
        },
        {
          "type": "paragraph",
          "text": "The JVM acts as an interpreter, translating bytecode into machine-specific instructions."
        },
        {
          "type": "paragraph",
          "text": "This 'Write Once, Run Anywhere' capability is a cornerstone of Java's design philosophy."
        },
        {
          "type": "paragraph",
          "text": "It simplifies development and deployment across diverse computing environments."
        },
        {
          "type": "paragraph",
          "text": "Developers can focus on logic rather than worrying about underlying hardware or OS."
        }
      ]
    },
    {
      "title": "Object-Oriented Programming (OOP)",
      "content": [
        {
          "type": "heading",
          "text": "Core OOP Principles"
        },
        {
          "type": "paragraph",
          "text": "Java is fundamentally an object-oriented language, supporting concepts like encapsulation, inheritance, and polymorphism."
        },
        {
          "type": "paragraph",
          "text": "Encapsulation bundles data and methods that operate on the data within a single unit, preventing direct access."
        },
        {
          "type": "paragraph",
          "text": "Inheritance allows new classes to inherit properties and behaviors from existing classes, promoting code reuse."
        },
        {
          "type": "paragraph",
          "text": "Polymorphism enables objects of different classes to be treated as objects of a common type, enhancing flexibility."
        },
        {
          "type": "paragraph",
          "text": "Abstraction focuses on showing only essential information and hiding complex implementation details."
        },
        {
          "type": "paragraph",
          "text": "These principles contribute to modular, reusable, and maintainable codebases."
        }
      ]
    },
    {
      "title": "Robustness and Security",
      "content": [
        {
          "type": "heading",
          "text": "Built-in Reliability"
        },
        {
          "type": "paragraph",
          "text": "Java is designed to be robust, emphasizing compile-time error checking and runtime exception handling."
        },
        {
          "type": "paragraph",
          "text": "It eliminates pointers, which are common sources of errors in languages like C++, reducing memory management issues."
        },
        {
          "type": "paragraph",
          "text": "The garbage collector automatically manages memory, freeing up objects that are no longer in use."
        },
        {
          "type": "paragraph",
          "text": "Security features are integral to Java, including a security manager that defines access rights for classes."
        },
        {
          "type": "paragraph",
          "text": "This makes Java suitable for developing secure network applications and distributed systems."
        },
        {
          "type": "paragraph",
          "text": "Its strong type checking and exception handling mechanisms contribute to highly reliable applications."
        }
      ]
    },
    {
      "title": "Multithreading and Performance",
      "content": [
        {
          "type": "heading",
          "text": "Concurrency Support"
        },
        {
          "type": "paragraph",
          "text": "Java provides built-in support for multithreading, allowing concurrent execution of multiple parts of a program."
        },
        {
          "type": "paragraph",
          "text": "This feature is crucial for developing interactive and high-performance applications, especially in server-side programming."
        },
        {
          "type": "paragraph",
          "text": "Threads share a common memory area, enabling efficient communication and resource sharing."
        },
        {
          "type": "paragraph",
          "text": "While often criticized for performance compared to C++, modern JVMs and JIT compilers have significantly improved Java's speed."
        },
        {
          "type": "paragraph",
          "text": "Optimizations like Just-In-Time (JIT) compilation convert bytecode into native machine code at runtime."
        },
        {
          "type": "paragraph",
          "text": "This results in performance that is often comparable to, or even surpasses, compiled languages for certain tasks."
        }
      ]
    },
    {
      "title": "Rich API and Ecosystem",
      "content": [
        {
          "type": "heading",
          "text": "Extensive Libraries"
        },
        {
          "type": "paragraph",
          "text": "Java boasts a vast and comprehensive Application Programming Interface (API) that provides ready-to-use classes and interfaces."
        },
        {
          "type": "paragraph",
          "text": "This rich API covers areas from networking and database connectivity to GUI development and XML parsing."
        },
        {
          "type": "paragraph",
          "text": "Beyond the core API, Java has a massive open-source ecosystem with countless third-party libraries and frameworks."
        },
        {
          "type": "paragraph",
          "text": "Frameworks like Spring, Hibernate, and Apache Struts simplify complex development tasks and accelerate project delivery."
        },
        {
          "type": "paragraph",
          "text": "The strong community support ensures continuous development and availability of resources."
        },
        {
          "type": "paragraph",
          "text": "This extensive ecosystem is a major reason for Java's enduring popularity and versatility."
        }
      ]
    }
  ]
}
```

### API Response

Upon successful conversion, the API will return a JSON object containing details about the generated PPTX file, including a download URL:

```json
{
  "success": true,
  "file": {
    "name": "[unique-uuid].pptx",
    "path": "Z:\\projects\\FINAL_YEAR_MICROSERVICES\\html to pdf\\pptx-converter\\output\\unique-uuid.pptx",
    "downloadUrl": "http://127.0.0.1:5002/output/[unique-uuid].pptx"
  }
}
```

### Testing with Postman

1.  Ensure the Flask application is running.
2.  Open Postman.
3.  Create a new POST request.
4.  Set the URL to `http://127.0.0.1:5002/convert-pptx`.
5.  Set the `Content-Type` header to `application/json`.
6.  In the request body, select `raw` and `JSON` and paste the example request body provided above.
7.  Send the request. The server will respond with a JSON object containing the file details and a `downloadUrl`.