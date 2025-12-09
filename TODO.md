# TODO: Fix Data Sync Issue Across Devices

## Problem
- Application uses localStorage for data storage (client-side)
- Data doesn't sync across different devices/browsers
- Server has MongoDB setup but frontend isn't using it

## Solution Plan
- [x] Fix server.js to use only MongoDB (remove SQLite references)
- [x] Update js/data.js to make API calls instead of localStorage
- [x] Update js/therapist-dashboard.js to use API calls
- [x] Update js/auth.js to use API calls
- [x] Update js/customer-dashboard.js to use API calls
- [ ] Test the changes to ensure data syncs across devices

## Current Status
- Server.js updated to use only MongoDB (connection options fixed)
- js/data.js updated to use API calls
- js/therapist-dashboard.js updated to use async API calls
- js/auth.js updated to use async API calls
- js/customer-dashboard.js updated to use async API calls
- Issue: MongoDB not installed/running locally
- Next: Set up MongoDB (Atlas cloud or local) and test data sync across devices
