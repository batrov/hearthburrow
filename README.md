## Pre-requisite
- Node.js (which includes npm)
- Vite (installed automatically — see below)

To get `npm` (Node Package Manager) on your computer, the easiest and most reliable way is to install **Node.js**. Because `npm` is the default package manager for Node.js, they come bundled together—install one, and you automatically get the other.

**Vite** is the development server and build tool used by this project. It is listed as a devDependency in `package.json`, so it will be installed automatically when you run `npm install`. You do not need to install it separately.

Here is the straightforward guide to getting everything up and running.

---

## Step 1: Download and Install Node.js

### For Windows & macOS

1. Go to the official **[Node.js Website](https://nodejs.org/)**.
2. You will see two versions available for download:
* **LTS (Long Term Support):** Recommended for most users. It is the most stable version.
* **Current:** Has the latest features, but might be slightly less stable.


3. Click on the **LTS** button to download the installer for your operating system.
4. Run the downloaded file (the `.msi` for Windows or `.pkg` for macOS) and follow the installation wizard prompts. *Just click "Next" through the defaults; they are exactly what you need.*

### For Linux (Ubuntu/Debian)

Open your terminal and run the following commands to install it via the NodeSource repository (which ensures you get a modern version):

```bash
# Update your package index
sudo apt update

# Install Node.js and npm
sudo apt install nodejs npm

```

---

## Step 2: Verify the Installation

Once the installer finishes, you need to make sure everything went smoothly.

1. Open your terminal (**Command Prompt** or **PowerShell** on Windows, **Terminal** on macOS/Linux).
2. Type the following commands one by one and press **Enter**:

```bash
node -v

```

*(This checks the Node.js version. It should return something like `v20.x.x` or `v22.x.x`.)*

```bash
npm -v

```

*(This checks the npm version. It should return a version number like `10.x.x`.)*

> **Note for Windows Users:** If your terminal says something like *"command not found"*, try restarting your terminal or your computer. This forces Windows to refresh its system paths.


## Running
```bash
npm run dev

```
By default, the game will run using port 3000 in your browser
