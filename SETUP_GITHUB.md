# Setting Up GitHub Repository for GSH

Follow these steps to create and connect your GitHub repository:

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `GSH` (or `gsh-shopping`, `gsh-app`, etc.)
3. Description: "Household management app with shopping lists, tasks, notes, and reminders"
4. Choose **Public** or **Private**
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click **"Create repository"**

## Step 2: Copy Your Repository URL

After creating the repository, GitHub will show you the repository URL. It will look like:
- HTTPS: `https://github.com/YOUR_USERNAME/GSH.git`
- SSH: `git@github.com:YOUR_USERNAME/GSH.git`

**Copy this URL** - you'll need it in the next step.

## Step 3: Connect Local Repository to GitHub

Once you have your repository URL, run these commands (replace YOUR_URL with your actual repository URL):

```bash
cd C:\Users\ergod\GSHSHOPING
git remote add origin YOUR_URL
git branch -M main
git push -u origin main
```

Or if you prefer HTTPS:
```bash
git remote add origin https://github.com/YOUR_USERNAME/GSH.git
git push -u origin main
```

## Step 4: Verify Connection

Check that everything is connected:
```bash
git remote -v
```

You should see your repository URL listed.

## Next Steps

After pushing, your code will be on GitHub. You can:
- View it at: `https://github.com/YOUR_USERNAME/GSH`
- Continue making commits and pushing with: `git push`
- Pull changes with: `git pull`

