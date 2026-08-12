const crypto = require("crypto");


// =====================================================
// CREATE TOKEN
// =====================================================

function createClaimToken() {

  const token =
    crypto
      .randomBytes(32)
      .toString("hex");


  const hash =
    crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");


  return {
    token,
    hash,
  };

}


// =====================================================
// HASH TOKEN
// =====================================================

function hashClaimToken(
  token
) {

  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

}


module.exports = {

  createClaimToken,

  hashClaimToken,

};