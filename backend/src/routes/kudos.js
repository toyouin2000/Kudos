const express = require("express");

const supabase =
  require("../db/supabase");

const verifySlackRequest =
  require("../slack/verifyRequest");

const router =
  express.Router();


router.post(
  "/commands",
  async (req, res) => {

    try {

      // ============================================
      // VERIFY SLACK
      // ============================================

      const valid =
        verifySlackRequest(req);

      if (!valid) {

        return res.status(401).send(
          "Invalid Slack request"
        );

      }


      // ============================================
      // SLACK PAYLOAD
      // ============================================

      const {
        user_id: senderSlackId,
        team_id: slackTeamId,
        text,
        response_url: responseUrl,
      } = req.body;


      console.log(
        "Kudos command:",
        req.body
      );


      // ============================================
      // CHECK ORGANIZATION
      // ============================================

      const {
        data: organization,
        error: organizationError,
      } = await supabase
        .from("organizations")
        .select("id")
        .eq(
          "slack_team_id",
          slackTeamId
        )
        .maybeSingle();


      if (organizationError) {

        console.error(
          organizationError
        );

        return res.status(500).send(
          "Database error"
        );

      }


      if (!organization) {

        return res.status(403).send(
          "This Slack workspace is not connected to Kudos."
        );

      }


      // ============================================
      // PARSE COMMAND
      // ============================================

      const parsed =
        parseKudosCommand(text);


      if (!parsed) {

        return res.send(
          "Usage: /kudos @person points message\n\nExample: /kudos @alice 20 Great work!"
        );

      }


      const {
        receiverSlackId,
        points,
        message,
      } = parsed;


      // ============================================
      // VALIDATE POINTS
      // ============================================

      if (
        !Number.isInteger(points) ||
        points <= 0
      ) {

        return res.send(
          "Points must be a positive whole number."
        );

      }


      if (points > 1000) {

        return res.send(
          "You can give a maximum of 1000 points at once."
        );

      }


      // ============================================
      // FIND SENDER
      // ============================================

      const {
        data: sender,
        error: senderError,
      } = await supabase
        .from("users")
        .select(`
          id,
          name,
          reward_balance
        `)
        .eq(
          "organization_id",
          organization.id
        )
        .eq(
          "slack_user_id",
          senderSlackId
        )
        .maybeSingle();


      if (senderError) {

        console.error(
          senderError
        );

        return res.status(500).send(
          "Database error"
        );

      }


      if (!sender) {

        return res.send(
          "You are not registered in the Kudos workspace."
        );

      }


      // ============================================
      // FIND RECEIVER
      // ============================================

      const {
        data: receiver,
        error: receiverError,
      } = await supabase
        .from("users")
        .select(`
          id,
          name,
          slack_user_id
        `)
        .eq(
          "organization_id",
          organization.id
        )
        .eq(
          "slack_user_id",
          receiverSlackId
        )
        .maybeSingle();


      if (receiverError) {

        console.error(
          receiverError
        );

        return res.status(500).send(
          "Database error"
        );

      }


      if (!receiver) {

        return res.send(
          "That person is not registered in Kudos."
        );

      }


      // ============================================
      // CANNOT KUDOS YOURSELF
      // ============================================

      if (
        sender.id ===
        receiver.id
      ) {

        return res.send(
          "You cannot give kudos to yourself."
        );

      }


      // ============================================
      // CHECK BALANCE
      // ============================================

      if (
        sender.reward_balance <
        points
      ) {

        return res.send(
          `You only have ${sender.reward_balance} points available.`
        );

      }


      // ============================================
      // UPDATE SENDER
      // ============================================

      const {
        data: updatedSender,
        error: senderUpdateError,
      } = await supabase
        .from("users")
        .update({
          reward_balance:
            sender.reward_balance -
            points,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          sender.id
        )
        .eq(
          "organization_id",
          organization.id
        )
        .gte(
          "reward_balance",
          points
        )
        .select()
        .maybeSingle();


      if (
        senderUpdateError
      ) {

        console.error(
          senderUpdateError
        );

        return res.status(500).send(
          "Failed to update balance."
        );

      }


      if (!updatedSender) {

        return res.send(
          "Your points balance changed. Please try again."
        );

      }


      // ============================================
      // UPDATE RECEIVER
      // ============================================

      const {
        data: updatedReceiver,
        error: receiverUpdateError,
      } = await supabase
        .from("users")
        .update({
          received_balance:
            supabase.raw
              ? undefined
              : undefined,
        })
        .eq(
          "id",
          receiver.id
        )
        .select()
        .single();


      // We'll replace this with a database
      // transaction function in the next section.


      if (
        receiverUpdateError
      ) {

        console.error(
          receiverUpdateError
        );

        return res.status(500).send(
          "Failed to update receiver balance."
        );

      }


      // Placeholder response
      return res.send(
        `🎉 Kudos processed: ${points} points to ${receiver.name}!`
      );

    } catch (error) {

      console.error(
        "Kudos error:",
        error
      );

      return res.status(500).send(
        "Something went wrong."
      );

    }

  }
);


// ====================================================
// PARSE KUDOS COMMAND
// ====================================================

function parseKudosCommand(
  text
) {

  if (!text) {
    return null;
  }

  const trimmed =
    text.trim();

  /*
    Expected:

    @alice 20 Great work!

    Slack normally sends:

    <@U123ABC> 20 Great work!
  */

  const match =
    trimmed.match(
      /^<@([A-Z0-9]+)>\s+(\d+)(?:\s+(.+))?$/i
    );


  if (!match) {
    return null;
  }


  return {

    receiverSlackId:
      match[1],

    points:
      Number(match[2]),

    message:
      match[3] || "",

  };
}


module.exports =
  router;