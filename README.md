# Finance

A local finance app for a student household. It runs on a Mac. The phone apps talk to that Mac. The SQLite database stays on the machine and is not in this repository.

## Stack

Electron, React, TypeScript, SQLite, Capacitor (iOS and Android)

## What you can do

- Month overview: income, spending, and what is left
- Transactions
- Car and apartment costs
- Shopping, bills, and debts
- Dohodnina (Slovenian income-tax helper)
- Pair a phone to the Mac over the local network

## Run it

```bash
npm install
npm run dev
```

The database is created under `data/` (gitignored).

## Phone

Build the phone UI, then open the native project:

```bash
npm run phone:sync
npm run phone:open:ios
# or
npm run phone:open
```
