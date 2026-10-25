TRICERT LAB: LOCAL COPY (VERSION 6)

What you need
-------------
- Node.js 22.13 or newer: https://nodejs.org/
- An internet connection for the first setup only, so npm can install dependencies.

How to run it
-------------
1. Extract the ZIP file to a folder on your computer. On Windows, use a folder outside
   OneDrive (for example C:\TriCertLab) so syncing does not lock files during npm ci.
2. Open Terminal (macOS) or PowerShell (Windows) in that folder.
3. Run:

   npm ci
   npm run dev

4. Open http://localhost:3000 in your browser.
5. Keep the Terminal or PowerShell window open while using the site.
6. Press Ctrl+C in that window when you want to stop the local site.

Your information
----------------
- This copy contains the complete TriCert Lab source, learning materials, datasets,
  and logo.
- The hosted site's saved progress is stored separately and is not copied into this
  package automatically.
- Progress created in one local browser may not automatically appear on another
  computer. Use the hosted private site when you need the same progress everywhere.

Updating from version 5
-----------------------
- A new folder starts with an empty plan. To keep the progress from your version 5
  folder, copy its hidden .wrangler folder into this folder before npm run dev.
- On first start, version 6 adds two fields to your profile (your name and your
  reason for studying) without touching your progress. Open "Make it yours" in the
  sidebar to fill them in, pick your colour and choose light or night.

Useful commands
---------------
- npm test        Run the content tests.
- npm run build   Create a production build.
- npm run start   Start the production build after running npm run build.

