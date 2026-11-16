# CampusPass

A browser-based smart attendance mini-project built with Next.js, React, and TypeScript. It provides an overview dashboard, student registration, an attendance register, CSV export, and face, RFID UID, and manual attendance flows.

## Run the project

1. Install Node.js if it is not already installed.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the local URL printed by Next.js (usually `http://localhost:3000`).

## Project behavior

- The sample directory contains three generic demo students. Replace them with consenting participants for a demonstration. Attendance and student changes are saved in the current browser using local storage.
- Sample RFID UIDs are displayed on the Recognition screen and on each student record. The UID field can accept a reader that types the UID and submits Enter, but no physical reader is currently connected.
- Use **Students → Enroll face** to capture a consenting student's face descriptor. **Recognition → Start camera → Identify & record** compares the live camera descriptor with enrolled descriptors using the Human face matching library. The library computes face descriptions and compares them against saved descriptors: https://github.com/vladmandic/human/wiki/Embedding.
- Face descriptors remain in this browser's local storage; the app does not upload face images. This classroom prototype does not verify liveness, and its matching threshold has not been evaluated for production use.
- Use the date picker in Attendance to review records and download the filtered register as CSV.

This is a classroom prototype. A deployment should add server-side authentication, a database, authorization, audit history, and evaluated biometric matching before use with real attendance data. Enroll face data only with each student's informed consent and provide an alternate attendance method.

## Face model credits

The included model files are distributed under the licenses of their original model sources. See the [Human model credits and license notes](https://github.com/vladmandic/human/wiki/Models) before redistributing or deploying this project.
