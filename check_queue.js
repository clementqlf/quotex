const fs = require('fs');
const path = require('path');
// Since it's a react native app using AsyncStorage, where is the data stored?
// AsyncStorage on iOS/Android is stored in sqlite/files.
// But wait, is there a way we can just inspect the logs from the React Native app?
