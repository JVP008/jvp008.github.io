(function () {
  // ──────────────────────────────────────────────────────────
  // CONFIGURATION: Paste your Google Apps Script Web App URL here!
  // e.g. "https://script.google.com/macros/s/XXXXX/exec"
  const GOOGLE_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbwe-Volv2L-CvhE0AESyPCSVLCginT6-R1dd6BHQwVHWtURiUr9wAYKtyCYVR7tt5xlbg/exec";
  // ──────────────────────────────────────────────────────────

  // Find the container or article to insert the comment section
  const container = document.querySelector(".container");
  const article = document.querySelector("article");
  if (!container || !article) return;

  // Create the comments section element
  const commentsSection = document.createElement("section");
  commentsSection.id = "comments-section";
  commentsSection.className = "comments-section";

  // Derive a unique key based on the page's filename
  const path = window.location.pathname;
  const filename =
    path.substring(path.lastIndexOf("/") + 1).replace(".html", "") || "index";
  const storageKey = `comments-${filename}`;

  // Insert commentsSection after article
  article.parentNode.insertBefore(commentsSection, article.nextSibling);

  // Helper to check if dark mode is active
  function isDarkMode() {
    return (
      document.body.classList.contains("dark") ||
      document.documentElement.classList.contains("dark")
    );
  }

  // Helper to escape HTML tags to prevent XSS
  function escapeHTML(str) {
    if (typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Helper to generate initials avatar colors dynamically
  function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 60%, 40%)`;
  }

  function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return [...parts[0]].slice(0, 2).join("").toUpperCase();
    }
    return ([...parts[0]][0] + [...parts[parts.length - 1]][0]).toUpperCase();
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  // Render a list of comments on the page
  function renderComments(commentsList, listContainerId) {
    const listContainer = document.getElementById(listContainerId);
    if (!listContainer) return;

    listContainer.innerHTML = "";

    if (commentsList.length === 0) {
      listContainer.innerHTML =
        '<p class="no-comments">No comments yet. Be the first to comment!</p>';
      return;
    }

    commentsList.forEach((comment) => {
      const card = document.createElement("div");
      card.className = "comment-card";

      const initials = getInitials(comment.author);
      const avatarColor = getAvatarColor(comment.author);
      const formattedDate = formatDate(comment.timestamp);

      card.innerHTML = `
        <div class="comment-avatar" style="background-color: ${avatarColor};" aria-hidden="true">
          ${escapeHTML(initials)}
        </div>
        <div class="comment-content">
          <div class="comment-header">
            <span class="comment-author">${escapeHTML(comment.author)}</span>
            <span class="comment-date">${formattedDate}</span>
          </div>
          <div class="comment-body">${escapeHTML(comment.body)}</div>
        </div>
      `;
      listContainer.appendChild(card);
    });
  }

  // Setup UI elements for comments
  function setupUI(isSetupNeeded) {
    commentsSection.innerHTML = `
      <hr />
      ${
        isSetupNeeded
          ? `
        <div class="database-setup-alert">
          <p><strong>Database Setup Needed!</strong> To enable comments on your live blog, please follow the steps in <code>google_sheets_setup.md</code> and paste your Web App URL in <code>blog-comments.js</code>.</p>
        </div>
      `
          : ""
      }
      <h2>Comments</h2>
      <div id="comments-list" class="comments-list">
        <p class="no-comments">Loading comments...</p>
      </div>

      <form id="comment-form" class="comment-form">
        <h3>Leave a Comment</h3>
        <div class="comment-form-group">
          <label for="comment-author">Name <span class="required">*</span></label>
          <input type="text" id="comment-author" placeholder="Your name" required maxlength="50" />
        </div>
        <div class="comment-form-group">
          <label for="comment-email">Email <span class="hint">— provide email or LinkedIn (not published)</span></label>
          <input type="email" id="comment-email" placeholder="you@example.com" maxlength="100" />
        </div>
        <div class="comment-form-or">— OR —</div>
        <div class="comment-form-group">
          <label for="comment-linkedin">LinkedIn <span class="hint">— provide LinkedIn or email</span></label>
          <input type="url" id="comment-linkedin" placeholder="https://linkedin.com/in/yourprofile" maxlength="150" />
        </div>
        <p class="identity-note">* At least one of Email or LinkedIn is required to comment.</p>
        <div class="comment-form-group">
          <label for="comment-body-input">Message <span class="required">*</span></label>
          <textarea id="comment-body-input" placeholder="Join the discussion..." required maxlength="1000"></textarea>
        </div>
        <button type="submit" id="comment-submit-btn">Submit Comment</button>
      </form>
    `;
  }

  // ─── MODE 1: Setup Needed (Fallback / Local storage) ───
  if (
    !GOOGLE_SCRIPT_URL ||
    GOOGLE_SCRIPT_URL === "YOUR_GOOGLE_SCRIPT_URL_HERE"
  ) {
    setupUI(true);

    let localComments = [];
    try {
      const stored = localStorage.getItem(storageKey);
      localComments = stored ? JSON.parse(stored) || [] : [];
    } catch (e) {
      localComments = [];
    }

    renderComments(localComments, "comments-list");

    const commentForm = document.getElementById("comment-form");
    if (commentForm) {
      commentForm.addEventListener("submit", function (e) {
        e.preventDefault();

        const authorInput = document.getElementById("comment-author");
        const emailInput = document.getElementById("comment-email");
        const linkedinInput = document.getElementById("comment-linkedin");
        const bodyInput = document.getElementById("comment-body-input");

        const author = authorInput.value.trim();
        const email = emailInput ? emailInput.value.trim() : "";
        const linkedin = linkedinInput ? linkedinInput.value.trim() : "";
        const body = bodyInput.value.trim();

        if (!author || !body) return;

        if (!email && !linkedin) {
          alert(
            "Please provide your Email or LinkedIn to verify your identity.",
          );
          return;
        }

        // Check for duplicates
        const isDuplicate = localComments.some(
          (c) =>
            c.author.toLowerCase() === author.toLowerCase() &&
            c.body.trim() === body,
        );
        if (isDuplicate) {
          alert("You have already posted this exact comment!");
          return;
        }

        const newComment = {
          author: author,
          email: email,
          linkedin: linkedin,
          body: body,
          timestamp: Date.now(),
        };

        localComments.push(newComment);
        try {
          localStorage.setItem(storageKey, JSON.stringify(localComments));
        } catch (e) {}

        renderComments(localComments, "comments-list");

        authorInput.value = "";
        if (emailInput) emailInput.value = "";
        if (linkedinInput) linkedinInput.value = "";
        bodyInput.value = "";
      });
    }
  }
  // ─── MODE 2: Active Database (Google Sheet API) ───
  else {
    setupUI(false);

    let activeComments = [];

    // Fetch comments from Google Sheets
    function fetchComments() {
      fetch(`${GOOGLE_SCRIPT_URL}?pageId=${filename}`)
        .then((res) => res.json())
        .then((data) => {
          activeComments = data || [];
          renderComments(activeComments, "comments-list");
        })
        .catch((err) => {
          console.error("Failed to load comments from Google Sheets:", err);
          document.getElementById("comments-list").innerHTML =
            '<p class="no-comments" style="color: #d35400;">Failed to load comments from the database.</p>';
        });
    }

    fetchComments();

    const commentForm = document.getElementById("comment-form");
    const submitBtn = document.getElementById("comment-submit-btn");

    if (commentForm) {
      commentForm.addEventListener("submit", function (e) {
        e.preventDefault();

        const authorInput = document.getElementById("comment-author");
        const emailInput = document.getElementById("comment-email");
        const linkedinInput = document.getElementById("comment-linkedin");
        const bodyInput = document.getElementById("comment-body-input");

        const author = authorInput.value.trim();
        const email = emailInput ? emailInput.value.trim() : "";
        const linkedin = linkedinInput ? linkedinInput.value.trim() : "";
        const body = bodyInput.value.trim();

        if (!author || !body) return;

        if (!email && !linkedin) {
          alert(
            "Please provide your Email or LinkedIn to verify your identity.",
          );
          return;
        }

        // Check for duplicates
        const isDuplicate = activeComments.some(
          (c) =>
            c.author.toLowerCase() === author.toLowerCase() &&
            c.body.trim() === body,
        );
        if (isDuplicate) {
          alert("You have already posted this exact comment!");
          return;
        }

        // Visual feedback
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Posting...";
        }

        const newComment = {
          pageId: filename,
          author: author,
          email: email,
          linkedin: linkedin,
          body: body,
        };

        // Post to Google Sheet Web App
        fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          mode: "no-cors", // Required to bypass CORS redirect restrictions
          headers: {
            "Content-Type": "text/plain",
          },
          body: JSON.stringify(newComment),
        })
          .then(() => {
            // Local fallback addition for instant display
            const displayedComment = {
              author: author,
              body: body,
              timestamp: Date.now(),
            };
            activeComments.push(displayedComment);
            renderComments(activeComments, "comments-list");

            // Reset form
            authorInput.value = "";
            if (emailInput) emailInput.value = "";
            bodyInput.value = "";

            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = "Submit Comment";
            }

            // Fetch comments fresh to make sure it's saved correctly
            setTimeout(fetchComments, 1500);
          })
          .catch((err) => {
            console.error("Failed to submit comment:", err);
            alert("Failed to submit comment. Please try again.");
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = "Submit Comment";
            }
          });
      });
    }
  }
})();
