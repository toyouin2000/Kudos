const {
  WebClient,
} = require("@slack/web-api");


function createSlackClient(
  token
) {

  if (!token) {

    throw new Error(
      "Slack bot token is missing"
    );

  }


  return new WebClient(
    token
  );

}


module.exports = {
  createSlackClient,
};