
const {
  App,
} = require("@slack/bolt");

const supabase =
  require("../db/supabase");

const syncSlackMembers =
  require("./syncMembers");


let slackApp = null;


// =====================================================
// SLACK AUTHORIZATION
// =====================================================

async function authorizeSlack({
  teamId,
}) {

  console.log(
    "Authorizing Slack request:",
    {
      teamId,
    }
  );


  if (!teamId) {

    throw new Error(
      "Slack team ID is missing."
    );

  }


  // ===================================================
  // FIND ORGANIZATION USING SLACK TEAM ID
  // ===================================================

  const {
    data: organization,
    error,
  } = await supabase

    .from("organizations")

    .select(`
      id,
      name,
      slack_team_id,
      slack_bot_token,
      slack_bot_id
    `)

    .eq(
      "slack_team_id",
      teamId
    )

    .maybeSingle();


  if (error) {

    console.error(
      "Authorization DB error:",
      error
    );

    throw error;

  }


  if (!organization) {

    throw new Error(
      `No Kudos organization is connected to Slack team ${teamId}.`
    );

  }


  if (
    !organization.slack_bot_token
  ) {

    throw new Error(
      "Slack bot token is missing."
    );

  }


  return {

    botToken:
      organization.slack_bot_token,

    botId:
      organization.slack_bot_id,

    teamId,

  };

}


// =====================================================
// PARSE KUDOS COMMAND
// =====================================================

function parseKudosCommand(
  text
) {

  const input =
    (text || "").trim();


  /*
    Supported:

    /kudos @alice 20

    /kudos @alice 20 Great work!

    /kudos <@U123> 20

    /kudos <@U123> 20 Great work!
  */


  const mentionMatch =
    input.match(
      /^(<@([A-Z0-9]+)(?:\|[^>]+)?>|@([a-zA-Z0-9._-]+))\s+/
    );


  if (!mentionMatch) {

    return null;

  }


  const fullMention =
    mentionMatch[1];


  // If Slack sent:
  // <@U123>
  //
  // this contains the real Slack user ID.

  const slackUserId =
    mentionMatch[2] ||
    null;


  // If Slack sent:
  // @username
  //
  // we need to resolve it using Slack API.

  const username =
    mentionMatch[3] ||
    null;


  const remaining =
    input
      .substring(
        fullMention.length
      )
      .trim();


  const pointsMatch =
    remaining.match(
      /^(\d+)(?:\s+(.*))?$/
    );


  if (!pointsMatch) {

    return null;

  }


  const points =
    Number(
      pointsMatch[1]
    );


  const message =
    pointsMatch[2] ||
    "";


  return {

    slackUserId,

    username,

    points,

    message,

  };

}


// =====================================================
// FIND RECEIVER
// =====================================================

async function findReceiver({
  organizationId,
  slackUserId,
  username,
  botToken,
}) {

  // ===================================================
  // CASE 1
  //
  // Slack already gave us the actual user ID.
  // ===================================================

  if (slackUserId) {

    console.log(
      "Looking up receiver by Slack user ID:",
      slackUserId
    );


    const {
      data,
      error,
    } = await supabase

      .from("users")

      .select(`
        id,
        name,
        email,
        slack_user_id
      `)

      .eq(
        "organization_id",
        organizationId
      )

      .eq(
        "slack_user_id",
        slackUserId
      )

      .eq(
        "is_active",
        true
      )

      .maybeSingle();


    if (error) {

      throw error;

    }


    return data;

  }


  // ===================================================
  // CASE 2
  //
  // We only have @username.
  // Resolve it using Slack API.
  // ===================================================

  if (!username) {

    return null;

  }


  if (!botToken) {

    throw new Error(
      "Slack bot token is missing."
    );

  }


  const normalizedUsername =
    username
      .replace(/^@/, "")
      .toLowerCase();


  console.log(
    "Resolving Slack username:",
    normalizedUsername
  );


  // ===================================================
  // SLACK USERS.LIST
  // ===================================================

  let cursor = null;


  do {

    const params =
      new URLSearchParams();


    if (cursor) {

      params.set(
        "cursor",
        cursor
      );

    }


    const response =
      await fetch(

        `https://slack.com/api/users.list?${params.toString()}`,

        {

          method:
            "GET",

          headers: {

            Authorization:
              `Bearer ${botToken}`,

          },

        }

      );


    const slackData =
      await response.json();


    if (!slackData.ok) {

      throw new Error(
        `Slack users.list failed: ${slackData.error}`
      );

    }


    // =================================================
    // FIND MATCHING SLACK USER
    // =================================================

    const slackUser =
      (slackData.members || [])
        .find(
          (member) => {

            // Ignore bots
            if (
              member.is_bot ||
              member.is_app_user
            ) {

              return false;

            }


            // Ignore deleted users
            if (
              member.deleted
            ) {

              return false;

            }


            const usernameMatch =
              member.name
                ?.toLowerCase() ===
              normalizedUsername;


            const displayNameMatch =
              member.profile
                ?.display_name
                ?.toLowerCase() ===
              normalizedUsername;


            return (
              usernameMatch ||
              displayNameMatch
            );

          }
        );


    // =================================================
    // USER FOUND IN SLACK
    // =================================================

    if (slackUser) {

      console.log(
        "Slack receiver resolved:",
        {
          username:
            normalizedUsername,

          slackUserId:
            slackUser.id,

          slackName:
            slackUser.name,

          displayName:
            slackUser.profile?.display_name,
        }
      );


      // ===============================================
      // NOW LOOK UP OUR USER USING SLACK USER ID
      // ===============================================

      const {
        data,
        error,
      } = await supabase

        .from("users")

        .select(`
          id,
          name,
          email,
          slack_user_id
        `)

        .eq(
          "organization_id",
          organizationId
        )

        .eq(
          "slack_user_id",
          slackUser.id
        )

        .eq(
          "is_active",
          true
        )

        .maybeSingle();


      if (error) {

        throw error;

      }


      return data;

    }


    // =================================================
    // NEXT PAGE
    // =================================================

    cursor =
      slackData
        .response_metadata
        ?.next_cursor ||
      null;


  } while (cursor);


  return null;

}


// =====================================================
// INITIALIZE SLACK
// =====================================================

function initializeSlack() {

  if (slackApp) {

    return slackApp;

  }


  slackApp =
    new App({

      signingSecret:
        process.env.SLACK_SIGNING_SECRET,

      socketMode:
        true,

      appToken:
        process.env.SLACK_APP_TOKEN,

      authorize:
        authorizeSlack,

    });


  // ===================================================
  // /KUDOS
  // ===================================================

  slackApp.command(

    "/kudos",

    async ({
      command,
      ack,
      respond,
    }) => {

      // =================================================
      // ACK SLACK IMMEDIATELY
      // =================================================

      await ack();


      console.log(
        "Received /kudos command:",
        command
      );


      try {

        // =================================================
        // TEAM ID
        // =================================================

        const teamId =
          command.team_id ||
          command.team;


        if (!teamId) {

          await respond({

            text:
              "Unable to identify the Slack workspace.",

            response_type:
              "ephemeral",

          });

          return;

        }


        // =================================================
        // FIND ORGANIZATION
        //
        // IMPORTANT:
        // organization is declared HERE.
        // =================================================

        const {
          data: organization,
          error: organizationError,
        } = await supabase

          .from("organizations")

          .select(`
            id,
            name,
            slack_team_id,
            slack_bot_token,
            slack_bot_id,
            slack_bot_user_id
          `)

          .eq(
            "slack_team_id",
            teamId
          )

          .maybeSingle();


        if (organizationError) {

          console.error(
            "Organization lookup error:",
            organizationError
          );


          await respond({

            text:
              "Unable to identify your Kudos organization.",

            response_type:
              "ephemeral",

          });

          return;

        }


        if (!organization) {

          console.error(
            "No organization found for Slack team:",
            teamId
          );


          await respond({

            text:
              "This Slack workspace is not connected to Kudos.",

            response_type:
              "ephemeral",

          });

          return;

        }


        console.log(
          "Kudos organization identified:",
          {

            organizationId:
              organization.id,

            organizationName:
              organization.name,

            teamId,

          }
        );


        // =================================================
        // CHECK BOT TOKEN
        // =================================================

        if (
          !organization.slack_bot_token
        ) {

          console.error(
            "Slack bot token missing:",
            organization.id
          );


          await respond({

            text:
              "Slack connection is incomplete. Please reconnect Slack.",

            response_type:
              "ephemeral",

          });

          return;

        }


        // =================================================
        // PARSE COMMAND
        // =================================================

        const parsed =
          parseKudosCommand(
            command.text
          );


        if (!parsed) {

          await respond({

            text:
              "Usage: `/kudos @person 20 Great work!`",

            response_type:
              "ephemeral",

          });

          return;

        }


        console.log(
          "Parsed Kudos command:",
          parsed
        );


        // =================================================
        // VALIDATE POINTS
        // =================================================

        if (
          !Number.isInteger(
            parsed.points
          ) ||
          parsed.points <= 0
        ) {

          await respond({

            text:
              "Points must be a positive whole number.",

            response_type:
              "ephemeral",

          });

          return;

        }


        // =================================================
        // SENDER SLACK USER ID
        // =================================================

        const senderSlackUserId =
          command.user_id;


        if (!senderSlackUserId) {

          await respond({

            text:
              "Unable to identify the sender.",

            response_type:
              "ephemeral",

          });

          return;

        }


        console.log(
          "Looking up sender:",
          {
            organizationId:
              organization.id,

            slackUserId:
              senderSlackUserId,
          }
        );


        // =================================================
        // FIND SENDER
        // =================================================

        const {
          data: sender,
          error: senderError,
        } = await supabase

          .from("users")

          .select(`
            id,
            name,
            email,
            role,
            slack_user_id,
            reward_balance,
            received_balance,
            is_active
          `)

          .eq(
            "organization_id",
            organization.id
          )

          .eq(
            "slack_user_id",
            senderSlackUserId
          )

          .eq(
            "is_active",
            true
          )

          .maybeSingle();


        if (senderError) {

          console.error(
            "Sender lookup error:",
            senderError
          );


          await respond({

            text:
              "Unable to verify your Kudos account.",

            response_type:
              "ephemeral",

          });

          return;

        }


        // =================================================
        // SENDER NOT FOUND
        // =================================================

        if (!sender) {

          console.error(
            "SENDER_NOT_FOUND:",
            {

              organizationId:
                organization.id,

              senderSlackUserId,

              teamId,

            }
          );


          await respond({

            text:
              "Your Slack account is not linked to your Kudos account. Please ask your admin to sync Slack members.",

            response_type:
              "ephemeral",

          });

          return;

        }


        console.log(
          "Kudos sender identified:",
          {

            id:
              sender.id,

            name:
              sender.name,

            role:
              sender.role,

            slackUserId:
              sender.slack_user_id,

            rewardBalance:
              sender.reward_balance,

          }
        );


        // =================================================
        // FIND RECEIVER
        // =================================================

        const receiver =
          await findReceiver({

            organizationId:
              organization.id,

            slackUserId:
              parsed.slackUserId,

            username:
              parsed.username,

            botToken:
              organization.slack_bot_token,

          });


        // =================================================
        // RECEIVER NOT FOUND
        // =================================================

        if (!receiver) {

          console.error(
            "RECEIVER_NOT_FOUND:",
            {

              organizationId:
                organization.id,

              slackUserId:
                parsed.slackUserId,

              username:
                parsed.username,

            }
          );


          await respond({

            text:
              `I couldn't find @${parsed.username || "that user"} in this Kudos organization. Ask your admin to sync Slack members.`,

            response_type:
              "ephemeral",

          });

          return;

        }


        console.log(
          "Kudos receiver identified:",
          {

            id:
              receiver.id,

            name:
              receiver.name,

            email:
              receiver.email,

            slackUserId:
              receiver.slack_user_id,

          }
        );


        // =================================================
        // SELF KUDOS
        // =================================================

        if (
          receiver.slack_user_id ===
          sender.slack_user_id
        ) {

          await respond({

            text:
              "You cannot give Kudos to yourself.",

            response_type:
              "ephemeral",

          });

          return;

        }


        // =================================================
        // QUICK BALANCE CHECK
        //
        // RPC does the final atomic check.
        // =================================================

        if (
          sender.reward_balance <
          parsed.points
        ) {

          await respond({

            text:
              `You only have ${sender.reward_balance} reward points available.`,

            response_type:
              "ephemeral",

          });

          return;

        }


        // =================================================
        // ATOMIC KUDOS TRANSACTION
        // =================================================

        const {
          data: kudosResult,
          error: kudosError,
        } = await supabase.rpc(

          "give_kudos",

          {

            p_organization_id:
              organization.id,

            p_sender_slack_id:
              sender.slack_user_id,

            p_receiver_slack_id:
              receiver.slack_user_id,

            p_points:
              parsed.points,

            p_message:
              parsed.message ||
              "Great work!",

          }

        );


        // =================================================
        // RPC ERROR
        // =================================================

        if (kudosError) {

          console.error(
            "Give kudos error:",
            kudosError
          );


          const errorMessage =
            kudosError.message ||
            "";


          // -----------------------------------------------
          // INSUFFICIENT BALANCE
          // -----------------------------------------------

          if (
            errorMessage.includes(
              "INSUFFICIENT_REWARD_BALANCE"
            )
          ) {

            await respond({

              text:
                "You don't have enough reward points.",

              response_type:
                "ephemeral",

            });

            return;

          }


          // -----------------------------------------------
          // SENDER NOT FOUND
          // -----------------------------------------------

          if (
            errorMessage.includes(
              "SENDER_NOT_FOUND"
            )
          ) {

            await respond({

              text:
                "Your Slack account is not linked to Kudos. Please ask your admin to sync Slack members.",

              response_type:
                "ephemeral",

            });

            return;

          }


          // -----------------------------------------------
          // RECEIVER NOT FOUND
          // -----------------------------------------------

          if (
            errorMessage.includes(
              "RECEIVER_NOT_FOUND"
            )
          ) {

            await respond({

              text:
                "The recipient hasn't been synced to Kudos yet.",

              response_type:
                "ephemeral",

            });

            return;

          }


          // -----------------------------------------------
          // SELF KUDOS
          // -----------------------------------------------

          if (
            errorMessage.includes(
              "SELF_KUDOS_NOT_ALLOWED"
            )
          ) {

            await respond({

              text:
                "You cannot give Kudos to yourself.",

              response_type:
                "ephemeral",

            });

            return;

          }


          // -----------------------------------------------
          // INVALID POINTS
          // -----------------------------------------------

          if (
            errorMessage.includes(
              "INVALID_POINTS"
            )
          ) {

            await respond({

              text:
                "Points must be a positive number.",

              response_type:
                "ephemeral",

            });

            return;

          }


          // -----------------------------------------------
          // GENERIC ERROR
          // -----------------------------------------------

          await respond({

            text:
              "Something went wrong while giving Kudos. Please try again.",

            response_type:
              "ephemeral",

          });

          return;

        }


        // =================================================
        // SUCCESS
        // =================================================

        console.log(
          "Kudos transaction successful:",
          {

            result:
              kudosResult,

            organizationId:
              organization.id,

            sender:
              sender.name,

            receiver:
              receiver.name,

            points:
              parsed.points,

          }
        );


        await respond({

          text:
            `🎉 ${parsed.points} Kudos points sent to ${receiver.name}!`,

          response_type:
            "ephemeral",

        });


      } catch (error) {

        console.error(
          "Kudos command error:",
          error
        );


        await respond({

          text:
            "Something went wrong while processing your Kudos.",

          response_type:
            "ephemeral",

        });

      }

    }

  );


  return slackApp;

}


// =====================================================
// START SOCKET MODE
// =====================================================

async function startSlack() {

  const app =
    initializeSlack();


  await app.start();


  console.log(
    "⚡ Slack Socket Mode connected."
  );

}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

  initializeSlack,

  startSlack,

};
 
