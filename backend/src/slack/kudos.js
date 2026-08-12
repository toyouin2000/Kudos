const supabase =
  require("../db/supabase");


// =====================================================
// PARSE COMMAND
// =====================================================

function parseKudosCommand(text) {

  if (!text) {
    return null;
  }

  const trimmed =
    text.trim();


  // -----------------------------------------------
  // Slack ID format
  // -----------------------------------------------

  const slackIdMatch =
    trimmed.match(
      /^<@([A-Z0-9]+)>\s+(\d+)(?:\s+(.+))?$/i
    );


  if (slackIdMatch) {

    return {

      receiverSlackId:
        slackIdMatch[1],

      points:
        Number(
          slackIdMatch[2]
        ),

      message:
        slackIdMatch[3] || "",

    };

  }


  // -----------------------------------------------
  // Username format
  // -----------------------------------------------

  const usernameMatch =
    trimmed.match(
      /^@([a-zA-Z0-9._-]+)\s+(\d+)(?:\s+(.+))?$/
    );


  if (usernameMatch) {

    return {

      receiverUsername:
        usernameMatch[1],

      points:
        Number(
          usernameMatch[2]
        ),

      message:
        usernameMatch[3] || "",

    };

  }


  return null;
}


// =====================================================
// HANDLE KUDOS
// =====================================================

async function handleKudos(
  command,
  respond,
  client
) {

  const {
    user_id:
      senderSlackId,

    team_id:
      slackTeamId,

    text,
  } = command;


  // ===================================================
  // FIND ORGANIZATION
  // ===================================================

  const {
    data: organization,
    error:
      organizationError,
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

    return respond(
      "Something went wrong while finding your organization."
    );

  }


  if (!organization) {

    return respond(
      "This Slack workspace is not connected to Kudos."
    );

  }


  // ===================================================
  // PARSE
  // ===================================================

  const parsed =
    parseKudosCommand(text);


  if (!parsed) {

    return respond(
      "Usage: /kudos @person points message\n\nExample:\n/kudos @alice 20 Great work!"
    );

  }


  const {
    points,
    message,
  } = parsed;


  // ===================================================
  // VALIDATE POINTS
  // ===================================================

  if (
    !Number.isInteger(points) ||
    points <= 0
  ) {

    return respond(
      "Points must be a positive whole number."
    );

  }


  if (points > 1000) {

    return respond(
      "You can give a maximum of 1000 points at once."
    );

  }


  // ===================================================
  // FIND SENDER
  // ===================================================

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

    return respond(
      "Database error while finding your account."
    );

  }


  if (!sender) {

    return respond(
      "You are not registered in the Kudos workspace."
    );

  }


  // ===================================================
  // RESOLVE RECEIVER
  // ===================================================

  let receiverSlackId =
    parsed.receiverSlackId;


  if (
    !receiverSlackId &&
    parsed.receiverUsername
  ) {

    try {

      const result =
        await client.users.list({
          limit: 200,
        });


      const members =
        result.members || [];


      const target =
        members.find(
          (member) => {

            if (
              member.deleted ||
              member.is_bot
            ) {
              return false;
            }


            return (
              member.name
                ?.toLowerCase() ===
              parsed.receiverUsername
                .toLowerCase()
            );

          }
        );


      if (!target) {

        return respond(
          `I couldn't find Slack user @${parsed.receiverUsername}.`
        );

      }


      receiverSlackId =
        target.id;


    } catch (error) {

      console.error(
        "Slack user lookup error:",
        error
      );


      return respond(
        "Unable to find that Slack user."
      );

    }

  }


  // ===================================================
  // FIND RECEIVER
  // ===================================================

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

    return respond(
      "Database error while finding the recipient."
    );

  }


  if (!receiver) {

    return respond(
      "That person is not registered in Kudos."
    );

  }


  // ===================================================
  // SELF REWARD
  // ===================================================

  if (
    sender.id ===
    receiver.id
  ) {

    return respond(
      "You cannot give kudos to yourself."
    );

  }


  // ===================================================
  // ATOMIC TRANSACTION
  // ===================================================

  const {
    data: result,
    error:
      transactionError,
  } = await supabase.rpc(
    "give_kudos",
    {

      p_organization_id:
        organization.id,

      p_sender_id:
        sender.id,

      p_receiver_id:
        receiver.id,

      p_points:
        points,

      p_message:
        message,

    }
  );


  if (transactionError) {

    console.error(
      "Transaction error:",
      transactionError
    );


    if (
      transactionError.message.includes(
        "INSUFFICIENT_BALANCE"
      )
    ) {

      return respond(
        `You only have ${sender.reward_balance} points available.`
      );

    }


    if (
      transactionError.message.includes(
        "CANNOT_REWARD_SELF"
      )
    ) {

      return respond(
        "You cannot give kudos to yourself."
      );

    }


    return respond(
      "Failed to process kudos."
    );

  }


  console.log(
    "Kudos successful:",
    result
  );


  return respond(
    `🎉 ${sender.name} gave ${points} kudos points to ${receiver.name}!`
  );

}


module.exports = {
  handleKudos,
  parseKudosCommand,
};