# Mail-in-a-Box Mail Fetcher & Parser

This application retrieves specific user mail files from a Mail-in-a-Box server and mounts the `mailboxes` directory with read-only permissions. The purpose is to ensure that no changes within the container affect the actual mail data stored on the server.

The app can fetch email files, parse them, and extract relevant data like headers, sender/recipient information, subject, body, and attachments for further analysis.

## Features

*   Fetch read and unread email files.
*   Parse email content and extract key details.
*   Mount mailboxes with read-only access to prevent accidental changes.
*   Paginate email listings and filter by read/unread status.
*   Retrieve raw email content or parsed email data, including base64-encoded images and links.

## Environment Variables

*   **USERNAME**: The username for basic authentication.
*   **PASSWORD**: The password for basic authentication.
*   **PORT**: The port on which the application listens for requests.
*   **DIRECTORY\_PATH**: The path to the specific mailbox folder within the Mail-in-a-Box mailboxes directory (e.g., `/home/user-data/mail/mailboxes/domain.ltd/user/cur`).

## API Endpoints

### 1\. GET `/emails`

Fetch a list of read, unread, or all email files with pagination.

#### Query Parameters:

*   **page** (optional): The page number for pagination (default: 1).
*   **limit** (optional): The number of emails per page (default: 10).
*   **filter** (optional): Filter by 'read', 'unread', or 'all' (default: all).
*   **modifiedSince** (optional): Number of days since the email was last modified.

#### Example Request:

```
curl -u USERNAME:PASSWORD "http://localhost:3000/emails?page=1&limit=10&filter=read"
```

### 2\. POST `/emails/content`

Retrieve the raw content of a specified email file.

#### Body Parameters:

*   **file** (required): The name of the email file to retrieve the content.

#### Example Request:

```
curl -u USERNAME:PASSWORD -X POST -H "Content-Type: application/json" \
-d '{"file": "123456.eml"}' "http://localhost:3000/emails/content"
```

### 3\. POST `/emails/parse`

Parse and extract relevant data from the specified email file.

#### Body Parameters:

*   **file** (required): The name of the email file to parse.

#### Example Response:

*   Subject
*   From (sender)
*   To (recipient)
*   Date
*   Original recipient
*   Plain text and HTML bodies
*   Extracted links and base64-encoded images

#### Example Request:

```
curl -u USERNAME:PASSWORD -X POST -H "Content-Type: application/json" \
-d '{"file": "123456.eml"}' "http://localhost:3000/emails/parse"
```

### 4\. POST `/emails/body`

Extract and clean the email body, removing base64-encoded images and links.

#### Body Parameters:

*   **file** (required): The name of the email file to extract the body from.

#### Example Request:

```
curl -u USERNAME:PASSWORD -X POST -H "Content-Type: application/json" \
-d '{"file": "123456.eml"}' "http://localhost:3000/emails/body"
```

## Running the Application

1.  Clone the repository and navigate to the project directory:

    ```
    git clone <repository-url>
    cd <project-directory>
    ```

2.  Install dependencies:

    ```
    npm install
    ```

3.  Create a `.env` file in the root directory and specify the required environment variables:

    ```
    USERNAME=your_username
    PASSWORD=your_password
    PORT=3000
    DIRECTORY_PATH=/path/to/mailboxes
    ```

4.  Start the application:

    ```
    npm start
    ```

5.  The application will run on the specified `PORT`. You can interact with the API using the routes described above.

## Running the Application with Docker

To run the application using Docker, you only need to execute the following command:

```
docker-compose up -d
```

No further setup is required, aside from specifying the `.env` file with the necessary environment variables.

## Notes

*   The mounted mailboxes directory is read-only to ensure that no accidental modifications occur to the emails on the server.
*   You can authenticate requests using basic authentication with the `USERNAME` and `PASSWORD` specified in the environment variables.

## License

This project is licensed under the MIT License.