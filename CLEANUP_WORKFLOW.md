# Repository Cleanup Workflow

This guide describes a standard method for cleaning your repository by removing unwanted files from version control while keeping them in your working directory. This typically follows updating your `.gitignore` file (e.g., adding `node_modules/`, build directories, or environment files).

---

## Workflow Steps

1. **Untrack All Files (But Keep Them Locally):**
   ```bash
   git rm -r --cached .
   ```
2. **Restage Files (Excluding Those in `.gitignore`):**
   ```bash
   git add .
   ```
3. **Commit Your Changes:**
   ```bash
   git commit -m "تطهير المستودع وحذف الملفات الزائدة"
   ```

---

### Result
- Files and folders listed in `.gitignore` will no longer be tracked by git.
- Local copies remain on disk, but will not be committed anymore.
- Your repository size and history become cleaner and more manageable.

---

**Tip:**
Repeat this process whenever you update your `.gitignore` to enforce new ignore rules!
