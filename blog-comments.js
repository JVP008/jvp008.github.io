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

  // Saved commenter name helper
  const NAME_STORAGE_KEY = "commenter_name";

  function getSavedName() {
    try {
      return (localStorage.getItem(NAME_STORAGE_KEY) || "").trim();
    } catch (e) {
      return "";
    }
  }

  function saveName(name) {
    try {
      const clean = (name || "").trim();
      if (clean) {
        localStorage.setItem(NAME_STORAGE_KEY, clean);
        // Sync across all name inputs on the page
        document
          .querySelectorAll("#comment-author, .reply-author-input")
          .forEach((input) => {
            if (input && input.value !== clean) {
              input.value = clean;
            }
          });
      }
    } catch (e) {}
  }

  // Real-time synchronization when user types their name
  document.addEventListener("input", function (e) {
    if (
      e.target &&
      (e.target.id === "comment-author" ||
        e.target.classList.contains("reply-author-input"))
    ) {
      const val = e.target.value.trim();
      if (val) {
        try {
          localStorage.setItem(NAME_STORAGE_KEY, val);
        } catch (err) {}
      }
    }
  });

  // Helper to generate a unique commentId
  function generateCommentId() {
    return (
      "c_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).substring(2, 8)
    );
  }

  // Helper to generate avatar colors dynamically
  function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) {
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

  // Helper to manage local thread relationship cache
  const THREAD_CACHE_KEY = `comments_threads_${filename}`;

  function getThreadCache() {
    try {
      const raw = localStorage.getItem(THREAD_CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function cacheThreadReply(childId, parentId, signature) {
    try {
      const map = getThreadCache();
      if (childId) map[childId] = parentId;
      if (signature) map[signature] = parentId;
      localStorage.setItem(THREAD_CACHE_KEY, JSON.stringify(map));
    } catch (e) {}
  }

  // Build a tree from flat comment list (group replies under their parentId)
  function buildCommentTree(flatList) {
    const commentMap = new Map();
    const rootComments = [];
    const threadCache = getThreadCache();

    // Pass 1: Normalize comments, assign deterministic IDs if missing, and recover cached parentId
    flatList.forEach((comment, idx) => {
      const cleanAuthor = String(comment.author || "").trim();
      const cleanBody = String(comment.body || "").trim();
      const signature = `${cleanAuthor}_${cleanBody}`;

      const commentId = comment.commentId
        ? String(comment.commentId).trim()
        : comment.id
          ? String(comment.id).trim()
          : comment.timestamp
            ? `c_${comment.timestamp}_${cleanAuthor.replace(/\W/g, "")}`
            : `c_row_${idx}`;

      let parentId =
        comment.parentId &&
        comment.parentId !== "null" &&
        comment.parentId !== "undefined"
          ? String(comment.parentId).trim()
          : "";

      if (!parentId) {
        if (threadCache[commentId]) {
          parentId = String(threadCache[commentId]).trim();
        } else if (threadCache[signature]) {
          parentId = String(threadCache[signature]).trim();
        }
      }

      const normalized = {
        ...comment,
        commentId: commentId,
        parentId: parentId,
        children: [],
      };

      commentMap.set(commentId, normalized);
    });

    // Pass 2: Attach children to their parent or place in rootComments
    commentMap.forEach((comment) => {
      if (comment.parentId && commentMap.has(comment.parentId)) {
        commentMap.get(comment.parentId).children.push(comment);
      } else {
        rootComments.push(comment);
      }
    });

    return rootComments;
  }

  // Create a single comment card DOM element
  function createCommentCard(comment, isReply, onSubmitComment) {
    const card = document.createElement("div");
    card.className = "comment-card" + (isReply ? " is-reply" : "");
    card.dataset.commentId = comment.commentId;

    const initials = getInitials(comment.author);
    const avatarColor = getAvatarColor(comment.author);
    const formattedDate = formatDate(comment.timestamp);

    const cardContent = document.createElement("div");
    cardContent.className = "comment-content";

    cardContent.innerHTML = `
      <div class="comment-header">
        <span class="comment-author">${escapeHTML(comment.author)}</span>
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

    const currentSavedName = getSavedName();

    replyFormContainer.innerHTML = `
      <form class="comment-form reply-form">
        <div class="comment-form-group">
          <label>Name <span class="required">*</span></label>
          <input type="text" class="reply-author-input" placeholder="Your name" required maxlength="50" value="${escapeHTML(currentSavedName)}" />
        </div>
        <div class="comment-form-group reply-body-group">
          <label>Message <span class="required">*</span></label>
          <textarea class="reply-body-input" placeholder="Write your reply..." required maxlength="1000"></textarea>
        </div>
        <div class="reply-form-actions">
          <button type="submit" class="reply-submit-btn">Submit Reply</button>
          <button type="button" class="reply-cancel-btn">Cancel</button>
        </div>
      </form>
    `;

    cardContent.appendChild(replyFormContainer);

    const authorInput = replyFormContainer.querySelector(".reply-author-input");
    const bodyInput = replyFormContainer.querySelector(".reply-body-input");
    const cancelBtn = replyFormContainer.querySelector(".reply-cancel-btn");
    const replyForm = replyFormContainer.querySelector("form");

    // Toggle reply form visibility
    replyBtn.addEventListener("click", () => {
      const isVisible = replyFormContainer.style.display !== "none";
      if (isVisible) {
        replyFormContainer.style.display = "none";
      } else {
        replyFormContainer.style.display = "block";
        const latestName = getSavedName();
        if (authorInput && !authorInput.value && latestName) {
          authorInput.value = latestName;
        }
        if (authorInput && !authorInput.value) {
          authorInput.focus();
        } else if (bodyInput) {
          bodyInput.focus();
        }
      }
    });

    // Cancel reply button
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
    if (replyForm) {
      replyForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const submitBtn = replyForm.querySelector(".reply-submit-btn");
        const author = authorInput ? authorInput.value.trim() : "";
        const body = bodyInput ? bodyInput.value.trim() : "";

        if (!author) {
          if (authorInput) authorInput.focus();
          return;
        }

        if (!body) {
          if (bodyInput) bodyInput.focus();
          return;
        }

        saveName(author);

        const replyCommentData = {
          commentId: generateCommentId(),
          parentId: comment.commentId,
          author: author,
          body: body,
          timestamp: Date.now(),
        };

        cacheThreadReply(
          replyCommentData.commentId,
          comment.commentId,
          `${author}_${body}`
        );

        onSubmitComment(replyCommentData, submitBtn, () => {
          if (bodyInput) bodyInput.value = "";
          replyFormContainer.style.display = "none";
        });
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
    const savedName = getSavedName();

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
          <input type="text" id="comment-author" placeholder="Your name" required maxlength="50" value="${escapeHTML(savedName)}" />
        </div>
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

    function handleLocalSubmit(commentData, submitBtn, onComplete) {
      // Check for exact duplicates
      const isDuplicate = localComments.some(
        (c) =>
          c.author.toLowerCase() === commentData.author.toLowerCase() &&
          c.body.trim() === commentData.body.trim() &&
          (c.parentId || "") === (commentData.parentId || "")
      );
      if (isDuplicate) {
        alert("You have already posted this exact comment!");
        return;
      }

      localComments.push(commentData);
      try {
        localStorage.setItem(storageKey, JSON.stringify(localComments));
      } catch (e) {}

      renderComments(localComments, "comments-list", handleLocalSubmit);

      if (onComplete) onComplete();
    }

    renderComments(localComments, "comments-list", handleLocalSubmit);

    const commentForm = document.getElementById("comment-form");
    if (commentForm) {
      commentForm.addEventListener("submit", function (e) {
        e.preventDefault();

        const authorInput = document.getElementById("comment-author");
        const bodyInput = document.getElementById("comment-body-input");
        const submitBtn = document.getElementById("comment-submit-btn");

        const author = authorInput ? authorInput.value.trim() : "";
        const body = bodyInput ? bodyInput.value.trim() : "";

        if (!author) {
          if (authorInput) authorInput.focus();
          return;
        }

        if (!body) {
          if (bodyInput) bodyInput.focus();
          return;
        }

        saveName(author);

        const newComment = {
          commentId: generateCommentId(),
          parentId: "", // Top-level comment
          author: author,
          body: body,
          timestamp: Date.now(),
        };

        handleLocalSubmit(newComment, submitBtn, () => {
          if (bodyInput) bodyInput.value = "";
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
          (c.parentId || "") === (commentData.parentId || "")
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

          renderComments(activeComments, "comments-list", handleActiveSubmit);

          if (onComplete) onComplete();

          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent =
              submitBtn.classList &&
              submitBtn.classList.contains("reply-submit-btn")
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
              submitBtn.classList &&
              submitBtn.classList.contains("reply-submit-btn")
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
          const listEl = document.getElementById("comments-list");
          if (listEl) {
            listEl.innerHTML =
              '<p class="no-comments" style="color: #d35400;">Failed to load comments from the database.</p>';
          }
        });
    }

    fetchComments();

    const commentForm = document.getElementById("comment-form");
    const submitBtn = document.getElementById("comment-submit-btn");

    if (commentForm) {
      commentForm.addEventListener("submit", function (e) {
        e.preventDefault();

        const authorInput = document.getElementById("comment-author");
        const bodyInput = document.getElementById("comment-body-input");

        const author = authorInput ? authorInput.value.trim() : "";
        const body = bodyInput ? bodyInput.value.trim() : "";

        if (!author) {
          if (authorInput) authorInput.focus();
          return;
        }

        if (!body) {
          if (bodyInput) bodyInput.focus();
          return;
        }

        saveName(author);

        const newComment = {
          commentId: generateCommentId(),
          parentId: "", // Top-level comment
          author: author,
          body: body,
          timestamp: Date.now(),
        };

        handleActiveSubmit(newComment, submitBtn, () => {
          if (bodyInput) bodyInput.value = "";
        });
      });
    }
  }
})();
