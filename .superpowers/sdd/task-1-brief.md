### Task 1: Install dependencies & update package.json

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run bot` script, `ws` importable, `tsx` executable

- [ ] **Step 1: Add `ws` dependency and `tsx` devDependency, add `bot` script**

Read the current `package.json`, then replace it with:

```json
{
  "name": "nl-tranlates",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "bot": "tsx bot/index.ts"
  },
  "dependencies": {
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "~5.6.2",
    "vite": "^6.0.7"
  }
}
```

- [ ] **Step 2: Install**

```bash
npm install
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add ws, tsx, and bot script"
```
