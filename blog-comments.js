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

  // Helper to manage saved commenter identity
  const COMMENTER_STORAGE_KEY = "commenter_info";

  function getCommenterInfo() {
    try {
      const data = localStorage.getItem(COMMENTER_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  function saveCommenterInfo(name, email, linkedin) {
    try {
      localStorage.setItem(
        COMMENTER_STORAGE_KEY,
        JSON.stringify({
          name: (name || "").trim(),
          email: (email || "").trim(),
          linkedin: (linkedin || "").trim(),
        })
      );
    } catch (e) {}
  }

  // Helper to generate a unique commentId
  function generateCommentId() {
    return (
      "c_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).substring(2, 8)
    );
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

  // Build a tree from flat comment list (group replies under their parentId)
  function buildCommentTree(flatList) {
    const commentMap = new Map();
    const rootComments = [];

    // Normalize comments and index by commentId
    flatList.forEach((comment, idx) => {
      const commentId = comment.commentId
        ? String(comment.commentId).trim()
        : comment.timestamp
          ? `c_${comment.timestamp}_${idx}`
          : `c_${idx}`;

      const parentId =
        comment.parentId &&
        comment.parentId !== "null" &&
        comment.parentId !== "undefined"
          ? String(comment.parentId).trim()
          : "";

      const normalized = {
        ...comment,
        commentId: commentId,
        parentId: parentId,
        children: [],
      };

      commentMap.set(commentId, normalized);
    });

    // Attach children to their parent or place in rootComments
    commentMap.forEach((comment) => {
      if (comment.parentId && commentMap.has(comment.parentId)) {
        commentMap.get(comment.parentId).children.push(comment);
      } else {
        rootComments.push(comment);
      }
    });

    return rootComments;
  }

  // Create a single comment card DOM element (with reply button, inline reply form, and nested replies)
  function createCommentCard(comment, isReply, onSubmitComment) {
    const card = document.createElement("div");
    card.className = "comment-card" + (isReply ? " is-reply" : "");
    card.dataset.commentId = comment.commentId;

    const initials = getInitials(comment.author);
    const avatarColor = getAvatarColor(comment.author);
    const formattedDate = formatDate(comment.timestamp);

    const authorHtml = comment.linkedin
      ? `<a href="${escapeHTML(comment.linkedin)}" target="_blank" rel="noopener noreferrer" class="comment-author-link">${escapeHTML(comment.author)} 🔗</a>`
      : `<span class="comment-author">${escapeHTML(comment.author)}</span>`;

    const cardContent = document.createElement("div");
    cardContent.className = "comment-content";

    cardContent.innerHTML = `
      <div class="comment-header">
        ${authorHtml}
        <span class="comment-date">${formattedDate}</span>
      </div>
      <div class="comment-body">${escapeHTML(comment.body)}</div>
    `;

    // Action bar (Reply button + Expand/Collapse toggle)
    const actionsBar = document.createElement("div");
    actionsBar.className = "comment-actions";

    const replyBtn = document.createElement("button");
    replyBtn.type = "button";
    replyBtn.className = "comment-reply-btn";
    replyBtn.textContent = "Reply";
    actionsBar.appendChild(replyBtn);

    const hasReplies = comment.children && comment.children.length > 0;
    const replyCount = hasReplies ? comment.children.length : 0;
    let toggleBtn = null;

    if (hasReplies) {
      toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "reply-toggle-btn";
      // Collapsed by default if > 2 replies, expanded otherwise
      if (replyCount > 2) {
        toggleBtn.textContent = `View replies (${replyCount})`;
      } else {
        toggleBtn.textContent = "Hide replies";
      }
      actionsBar.appendChild(toggleBtn);
    }

    cardContent.appendChild(actionsBar);

    // Inline reply form container (hidden by default)
    const replyFormContainer = document.createElement("div");
    replyFormContainer.className = "reply-form-container";
    replyFormContainer.style.display = "none";

    const savedInfo = getCommenterInfo();
    const hasSavedIdentity =
      savedInfo && savedInfo.name && (savedInfo.email || savedInfo.linkedin);

    replyFormContainer.innerHTML = `
      <form class="comment-form reply-form">
        <div class="comment-identity-bar" style="${hasSavedIdentity ? "" : "display: none;"}">
          <span>Replying as <strong class="identity-name-display">${hasSavedIdentity ? escapeHTML(savedInfo.name) : ""}</strong></span>
          <button type="button" class="identity-edit-link">not you? edit</button>
        </div>
        <div class="comment-identity-fields" style="${hasSavedIdentity ? "display: none;" : ""}">
          <div class="comment-form-group">
            <label>Name <span class="required">*</span></label>
            <input type="text" class="reply-author-input" placeholder="Your name" required maxlength="50" value="${hasSavedIdentity ? escapeHTML(savedInfo.name) : ""}" />
          </div>
          <div class="comment-form-group">
            <label>Email <span class="hint">— provide email or LinkedIn (not published)</span></label>
            <input type="email" class="reply-email-input" placeholder="you@example.com" maxlength="100" value="${hasSavedIdentity && savedInfo.email ? escapeHTML(savedInfo.email) : ""}" />
          </div>
          <div class="comment-form-or">— OR —</div>
          <div class="comment-form-group">
            <label>LinkedIn <span class="hint">— provide LinkedIn or email</span></label>
            <input type="url" class="reply-linkedin-input" placeholder="https://linkedin.com/in/yourprofile" maxlength="150" value="${hasSavedIdentity && savedInfo.linkedin ? escapeHTML(savedInfo.linkedin) : ""}" />
          </div>
          <p class="identity-note">* At least one of Email or LinkedIn is required to reply.</p>
        </div>
        <div class="comment-form-group">
          <label>Reply <span class="required">*</span></label>
          <textarea class="reply-body-input" placeholder="Write your reply..." required maxlength="1000"></textarea>
        </div>
        <div class="reply-form-actions">
          <button type="submit" class="reply-submit-btn">Submit Reply</button>
          <button type="button" class="reply-cancel-btn">Cancel</button>
        </div>
      </form>
    `;

    cardContent.appendChild(replyFormContainer);

    // Toggle "not you? edit" in reply form
    const identityEditBtn = replyFormContainer.querySelector(".identity-edit-link");
    const identityBar = replyFormContainer.querySelector(".comment-identity-bar");
    const identityFields = replyFormContainer.querySelector(".comment-identity-fields");
    const authorInput = replyFormContainer.querySelector(".reply-author-input");

    if (identityEditBtn && identityBar && identityFields) {
      identityEditBtn.addEventListener("click", () => {
        identityBar.style.display = "none";
        identityFields.style.display = "flex";
        if (authorInput) {
          authorInput.focus();
          authorInput.select();
        }
      });
    }

    // Replies container
    const repliesContainer = document.createElement("div");
    repliesContainer.className = "comment-replies";
    if (replyCount > 2) {
      repliesContainer.classList.add("collapsed");
    }

    if (hasReplies) {
      comment.children.forEach((child) => {
        const childCard = createCommentCard(child, true, onSubmitComment);
        repliesContainer.appendChild(childCard);
      });
    }

    cardContent.appendChild(repliesContainer);

    // Toggle reply form visibility
    replyBtn.addEventListener("click", () => {
      const isVisible = replyFormContainer.style.display !== "none";
      replyFormContainer.style.display = isVisible ? "none" : "block";
      if (!isVisible) {
        // Refresh saved identity in reply form in case it was updated in main form
        const currentSaved = getCommenterInfo();
        if (currentSaved && currentSaved.name && (currentSaved.email || currentSaved.linkedin)) {
          const nameDisplay = replyFormContainer.querySelector(".identity-name-display");
          const emailInput = replyFormContainer.querySelector(".reply-email-input");
          const linkedinInput = replyFormContainer.querySelector(".reply-linkedin-input");
          if (nameDisplay) nameDisplay.textContent = currentSaved.name;
          if (authorInput && !authorInput.value) authorInput.value = currentSaved.name;
          if (emailInput && !emailInput.value && currentSaved.email) emailInput.value = currentSaved.email;
          if (linkedinInput && !linkedinInput.value && currentSaved.linkedin) linkedinInput.value = currentSaved.linkedin;
        }

        const bodyInput = replyFormContainer.querySelector(".reply-body-input");
        if (bodyInput) bodyInput.focus();
      }
    });

    // Cancel reply button
    const cancelBtn = replyFormContainer.querySelector(".reply-cancel-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        replyFormContainer.style.display = "none";
      });
    }

    // Toggle replies expand / collapse
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const isCollapsed = repliesContainer.classList.contains("collapsed");
        if (isCollapsed) {
          repliesContainer.classList.remove("collapsed");
          toggleBtn.textContent = "Hide replies";
        } else {
          repliesContainer.classList.add("collapsed");
          toggleBtn.textContent = `View replies (${comment.children.length})`;
        }
      });
    }

    // Reply form submission
    const replyForm = replyFormContainer.querySelector("form");
    if (replyForm) {
      replyForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const emailInput = replyForm.querySelector(".reply-email-input");
        const linkedinInput = replyForm.querySelector(".reply-linkedin-input");
        const bodyInput = replyForm.querySelector(".reply-body-input");
        const submitBtn = replyForm.querySelector(".reply-submit-btn");

        const currentSaved = getCommenterInfo();
        const author = authorInput ? authorInput.value.trim() : (currentSaved ? currentSaved.name : "");
        const email = emailInput ? emailInput.value.trim() : (currentSaved ? currentSaved.email : "");
        const linkedin = linkedinInput ? linkedinInput.value.trim() : (currentSaved ? currentSaved.linkedin : "");
        const body = bodyInput.value.trim();

        if (!author || !body) return;

        if (!email && !linkedin) {
          alert("Please provide your Email or LinkedIn to verify your identity.");
          return;
        }

        // Save commenter identity to localStorage
        saveCommenterInfo(author, email, linkedin);

        const replyCommentData = {
          commentId: generateCommentId(),
          parentId: comment.commentId,
          author: author,
          email: email,
          linkedin: linkedin,
          body: body,
          timestamp: Date.now(),
        };

        onSubmitComment(replyCommentData, submitBtn, () => {
          // Reset form and hide it
          bodyInput.value = "";
          replyFormContainer.style.display = "none";
        });
      });
    }

    card.innerHTML = `
      <div class="comment-avatar" style="background-color: ${avatarColor};" aria-hidden="true">
        ${escapeHTML(initials)}
      </div>
    `;
    card.appendChild(cardContent);

    return card;
  }

  // Render threaded comments on the page
  function renderComments(commentsList, listContainerId, onSubmitComment) {
    const listContainer = document.getElementById(listContainerId);
    if (!listContainer) return;

    listContainer.innerHTML = "";

    if (!commentsList || commentsList.length === 0) {
      listContainer.innerHTML =
        '<p class="no-comments">No comments yet. Be the first to comment!</p>';
      return;
    }

    const tree = buildCommentTree(commentsList);

    if (tree.length === 0) {
      listContainer.innerHTML =
        '<p class="no-comments">No comments yet. Be the first to comment!</p>';
      return;
    }

    tree.forEach((rootComment) => {
      const card = createCommentCard(rootComment, false, onSubmitComment);
      listContainer.appendChild(card);
    });
  }

  // Setup UI elements for comments
  function setupUI(isSetupNeeded) {
    const savedInfo = getCommenterInfo();
    const hasSavedIdentity =
      savedInfo && savedInfo.name && (savedInfo.email || savedInfo.linkedin);

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
        <div id="main-identity-bar" class="comment-identity-bar" style="${hasSavedIdentity ? "" : "display: none;"}">
          <span>Commenting as <strong id="main-identity-name">${hasSavedIdentity ? escapeHTML(savedInfo.name) : ""}</strong></span>
          <button type="button" id="main-identity-edit-btn" class="identity-edit-link">not you? edit</button>
        </div>
        <div id="main-identity-fields" class="comment-identity-fields" style="${hasSavedIdentity ? "display: none;" : ""}">
          <div class="comment-form-group">
            <label for="comment-author">Name <span class="required">*</span></label>
            <input type="text" id="comment-author" placeholder="Your name" required maxlength="50" value="${hasSavedIdentity ? escapeHTML(savedInfo.name) : ""}" />
          </div>
          <div class="comment-form-group">
            <label for="comment-email">Email <span class="hint">— provide email or LinkedIn (not published)</span></label>
            <input type="email" id="comment-email" placeholder="you@example.com" maxlength="100" value="${hasSavedIdentity && savedInfo.email ? escapeHTML(savedInfo.email) : ""}" />
          </div>
          <div class="comment-form-or">— OR —</div>
          <div class="comment-form-group">
            <label for="comment-linkedin">LinkedIn <span class="hint">— provide LinkedIn or email</span></label>
            <input type="url" id="comment-linkedin" placeholder="https://linkedin.com/in/yourprofile" maxlength="150" value="${hasSavedIdentity && savedInfo.linkedin ? escapeHTML(savedInfo.linkedin) : ""}" />
          </div>
          <p class="identity-note">* At least one of Email or LinkedIn is required to comment.</p>
        </div>
        <div class="comment-form-group">
          <label for="comment-body-input">Message <span class="required">*</span></label>
          <textarea id="comment-body-input" placeholder="Join the discussion..." required maxlength="1000"></textarea>
        </div>
        <button type="submit" id="comment-submit-btn">Submit Comment</button>
      </form>
    `;

    // Hook up the "not you? edit" link for the main form
    const mainEditBtn = document.getElementById("main-identity-edit-btn");
    const mainIdentityBar = document.getElementById("main-identity-bar");
    const mainIdentityFields = document.getElementById("main-identity-fields");
    const mainAuthorInput = document.getElementById("comment-author");

    if (mainEditBtn && mainIdentityBar && mainIdentityFields) {
      mainEditBtn.addEventListener("click", () => {
        mainIdentityBar.style.display = "none";
        mainIdentityFields.style.display = "flex";
        if (mainAuthorInput) {
          mainAuthorInput.focus();
          mainAuthorInput.select();
        }
      });
    }
  }

  // Update main identity UI when commenter_info is saved
  function refreshMainIdentityUI() {
    const savedInfo = getCommenterInfo();
    const mainIdentityBar = document.getElementById("main-identity-bar");
    const mainIdentityName = document.getElementById("main-identity-name");
    const mainIdentityFields = document.getElementById("main-identity-fields");
    const authorInput = document.getElementById("comment-author");
    const emailInput = document.getElementById("comment-email");
    const linkedinInput = document.getElementById("comment-linkedin");

    if (savedInfo && savedInfo.name && (savedInfo.email || savedInfo.linkedin)) {
      if (mainIdentityName) mainIdentityName.textContent = savedInfo.name;
      if (mainIdentityBar) mainIdentityBar.style.display = "flex";
      if (mainIdentityFields) mainIdentityFields.style.display = "none";
      if (authorInput) authorInput.value = savedInfo.name;
      if (emailInput && savedInfo.email) emailInput.value = savedInfo.email;
      if (linkedinInput && savedInfo.linkedin) linkedinInput.value = savedInfo.linkedin;
    }
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

    function handleLocalSubmit(commentData, submitBtn, onComplete) {
      // Check for exact duplicates
      const isDuplicate = localComments.some(
        (c) =>
          c.author.toLowerCase() === commentData.author.toLowerCase() &&
          c.body.trim() === commentData.body.trim() &&
          (c.parentId || "") === (commentData.parentId || ""),
      );
      if (isDuplicate) {
        alert("You have already posted this exact comment!");
        return;
      }

      localComments.push(commentData);
      try {
        localStorage.setItem(storageKey, JSON.stringify(localComments));
      } catch (e) {}

      refreshMainIdentityUI();
      renderComments(localComments, "comments-list", handleLocalSubmit);

      if (onComplete) onComplete();
    }

    renderComments(localComments, "comments-list", handleLocalSubmit);

    const commentForm = document.getElementById("comment-form");
    if (commentForm) {
      commentForm.addEventListener("submit", function (e) {
        e.preventDefault();

        const authorInput = document.getElementById("comment-author");
        const emailInput = document.getElementById("comment-email");
        const linkedinInput = document.getElementById("comment-linkedin");
        const bodyInput = document.getElementById("comment-body-input");
        const submitBtn = document.getElementById("comment-submit-btn");

        const currentSaved = getCommenterInfo();
        const author = authorInput ? authorInput.value.trim() : (currentSaved ? currentSaved.name : "");
        const email = emailInput ? emailInput.value.trim() : (currentSaved ? currentSaved.email : "");
        const linkedin = linkedinInput ? linkedinInput.value.trim() : (currentSaved ? currentSaved.linkedin : "");
        const body = bodyInput.value.trim();

        if (!author || !body) return;

        if (!email && !linkedin) {
          alert("Please provide your Email or LinkedIn to verify your identity.");
          return;
        }

        // Save commenter identity
        saveCommenterInfo(author, email, linkedin);

        const newComment = {
          commentId: generateCommentId(),
          parentId: "", // Top-level comment
          author: author,
          email: email,
          linkedin: linkedin,
          body: body,
          timestamp: Date.now(),
        };

        handleLocalSubmit(newComment, submitBtn, () => {
          bodyInput.value = "";
        });
      });
    }
  }
  // ─── MODE 2: Active Database (Google Sheet API) ───
  else {
    setupUI(false);

    let activeComments = [];

    function handleActiveSubmit(commentData, submitBtn, onComplete) {
      // Check for exact duplicates
      const isDuplicate = activeComments.some(
        (c) =>
          c.author.toLowerCase() === commentData.author.toLowerCase() &&
          c.body.trim() === commentData.body.trim() &&
          (c.parentId || "") === (commentData.parentId || ""),
      );
      if (isDuplicate) {
        alert("You have already posted this exact comment!");
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Posting...";
      }

      const payload = {
        pageId: filename,
        commentId: commentData.commentId || generateCommentId(),
        parentId: commentData.parentId || "",
        author: commentData.author,
        email: commentData.email,
        linkedin: commentData.linkedin,
        body: commentData.body,
      };

      // Post to Google Sheet Web App
      fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors", // Required to bypass CORS redirect restrictions
        headers: {
          "Content-Type": "text/plain",
        },
        body: JSON.stringify(payload),
      })
        .then(() => {
          // Instant optimistic display
          const displayedComment = {
            ...payload,
            timestamp: commentData.timestamp || Date.now(),
          };
          activeComments.push(displayedComment);
          
          refreshMainIdentityUI();
          renderComments(activeComments, "comments-list", handleActiveSubmit);

          if (onComplete) onComplete();

          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent =
              submitBtn.classList && submitBtn.classList.contains("reply-submit-btn")
                ? "Submit Reply"
                : "Submit Comment";
          }

          // Fetch comments fresh from Google Sheets to confirm
          setTimeout(fetchComments, 1500);
        })
        .catch((err) => {
          console.error("Failed to submit comment:", err);
          alert("Failed to submit comment. Please try again.");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent =
              submitBtn.classList && submitBtn.classList.contains("reply-submit-btn")
                ? "Submit Reply"
                : "Submit Comment";
          }
        });
    }

    // Fetch comments from Google Sheets
    function fetchComments() {
      fetch(`${GOOGLE_SCRIPT_URL}?pageId=${filename}`)
        .then((res) => res.json())
        .then((data) => {
          activeComments = data || [];
          renderComments(activeComments, "comments-list", handleActiveSubmit);
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

        const currentSaved = getCommenterInfo();
        const author = authorInput ? authorInput.value.trim() : (currentSaved ? currentSaved.name : "");
        const email = emailInput ? emailInput.value.trim() : (currentSaved ? currentSaved.email : "");
        const linkedin = linkedinInput ? linkedinInput.value.trim() : (currentSaved ? currentSaved.linkedin : "");
        const body = bodyInput.value.trim();

        if (!author || !body) return;

        if (!email && !linkedin) {
          alert("Please provide your Email or LinkedIn to verify your identity.");
          return;
        }

        // Save commenter identity
        saveCommenterInfo(author, email, linkedin);

        const newComment = {
          commentId: generateCommentId(),
          parentId: "", // Top-level comment
          author: author,
          email: email,
          linkedin: linkedin,
          body: body,
          timestamp: Date.now(),
        };

        handleActiveSubmit(newComment, submitBtn, () => {
          bodyInput.value = "";
        });
      });
    }
  }
})();

