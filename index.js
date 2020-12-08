const express = require('express');
const path = require('path');
const app = express();


//Handle general request
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname + "/LandingPage"))
})


//setting up port to listen to backend
const port = process.env.PORT || 5000;
app.listen(port);

console.log('App is listening on port ' + port);