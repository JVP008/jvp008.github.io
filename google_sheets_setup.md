# 📊 Google Sheets Comments Database Setup Guide

This guide will show you how to set up a **completely free** Google Sheets database to store and display public threaded comments on your blog posts, requiring **no logins or GitHub accounts** from your readers!

---

## 🛠️ Step 1: Create Your Google Sheet
1. Open [Google Sheets](https://sheets.google.com) and create a **Blank Spreadsheet**.
2. Rename the spreadsheet to something recognizable, like `Blog Comments`.
3. In the first row, create the following headers in columns **A** through **I**:
   * **A1**: `Timestamp`
   * **B1**: `PageId`
   * **C1**: `Author`
   * **D1**: `Email`
   * **E1**: `LinkedIn`
   * **F1**: `Message`
   * **G1**: `Approved`
   * **H1**: `CommentId`
   * **I1**: `ParentId`

*(Your sheet should look like this in row 1)*
| Row 1 | A | B | C | D | E | F | G | H | I |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Headers** | Timestamp | PageId | Author | Email | LinkedIn | Message | Approved | CommentId | ParentId |

---

## ✍️ Step 2: Set Up Google Apps Script
1. In your Google Sheet menu bar, click on **Extensions** > **Apps Script**.
2. Delete any code inside the script editor and copy-paste the following script:

```javascript
// Google Apps Script code for blog comments database with threaded replies

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var pageId = e.parameter ? e.parameter.pageId : "";
  
  var comments = [];
  
  // Header row is index 0 (Timestamp, PageId, Author, Email, LinkedIn, Message, Approved, CommentId, ParentId)
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowPageId = row[1];
    var authorDisplayName = row[2];
    var linkedinUrl = row[4]; // Column E is LinkedIn
    var message = row[5];
    var approved = row[6];
    var timestamp = row[0];
    var commentId = row[7] || "";
    var parentId = row[8] || "";
    
    // Only process comments that match the pageId and are approved (or true/blank)
    if (rowPageId === pageId && (approved === true || approved === "TRUE" || approved === "")) {
      comments.push({
        commentId: commentId ? commentId.toString() : "",
        parentId: parentId ? parentId.toString() : "",
        author: authorDisplayName,
        linkedin: linkedinUrl,
        body: message,
        timestamp: new Date(timestamp).getTime()
      });
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify(comments))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    
    var pageId = params.pageId;
    var author = params.author ? params.author.trim() : "";
    var email = params.email ? params.email.trim() : "";
    var linkedin = params.linkedin ? params.linkedin.trim() : "";
    var body = params.body ? params.body.trim() : "";
    var commentId = params.commentId ? params.commentId.toString().trim() : ("c_" + Date.now() + "_" + Math.floor(Math.random() * 10000));
    var parentId = params.parentId ? params.parentId.toString().trim() : "";
    
    // Identity check: Require at least Email or LinkedIn
    if (!email && !linkedin) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Email or LinkedIn is required." }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Duplicate Filter: Block exact duplicate comments (same page, author, message, and parent)
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowParentId = row[8] || "";
      if (row[1] === pageId && 
          row[2].toString().trim().toLowerCase() === author.toLowerCase() && 
          row[5].toString().trim() === body &&
          rowParentId.toString().trim() === parentId) {
        return ContentService.createTextOutput(JSON.stringify({ status: "duplicate", message: "Comment already exists." }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Append new row: Timestamp, PageId, Author, Email, LinkedIn, Message, Approved Status, CommentId, ParentId
    sheet.appendRow([
      new Date(),
      pageId,
      author,
      email,
      linkedin,
      body,
      "TRUE", // Auto-approved
      commentId,
      parentId
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. Click the **Save** icon (disk icon) in the toolbar or press `Ctrl + S`.

---

## 🚀 Step 3: Deploy the Web App (Or Update Deployment)
If you already deployed:
1. Click **Deploy** > **Manage deployments**.
2. Click the **pencil (edit) icon** next to the active deployment.
3. Under **Version**, select **New version**.
4. Click **Deploy**.

---

## 🔗 Step 4: Link Your Code
1. Open the file [blog-comments.js](file:///C:/Users/jayes/Desktop/Portfolio/blog-comments.js).
2. At the top of the file, find the line:
   ```javascript
   const GOOGLE_SCRIPT_URL = "YOUR_GOOGLE_SCRIPT_URL_HERE";
   ```
3. Replace it with your **Web app URL**.
4. Save the file.

