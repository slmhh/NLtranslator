### Task 6: Update tsconfig to include bot/

**Files:**
- Modify: `tsconfig.json`

**Change:** In `tsconfig.json`, change `"include": ["src"]` to `"include": ["src", "bot"]`.

The file should match exactly:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "bot"]
}
```

- [ ] **Step 1:** Modify `tsconfig.json` to change `"include": ["src"]` to `"include": ["src", "bot"]`
- [ ] **Step 2:** Verify by running `npx tsx bot/index.ts` — should error about missing .env (means TypeScript parses OK) or connection error (no NapCat running)
- [ ] **Step 3:** Commit: `git add tsconfig.json` then `git commit -m "chore: add bot/ to tsconfig include"`
