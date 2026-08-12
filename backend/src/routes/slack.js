const express =
  require("express");

const crypto =
  require("crypto");

const supabase =
  require("../db/supabase");

const authenticateToken =
  require("../middleware/auth");

const syncSlackMembers =
  require("../slack/syncMembers");


const router =
  express.Router();


// =====================================================
// ADMIN CHECK
// =====================================================

function requireAdmin(
  req,
  res,
  next
) {

  if (
    req.user.role !==
    "admin"
  ) {

    return res.status(403).json({

      error:
        "Only organization admins can manage Slack.",

    });

  }


  next();

}


// =====================================================
// START OAUTH
// =====================================================

router.get(

  "/connect",

  authenticateToken,

  requireAdmin,

  async (req, res) => {

    try {

      const organizationId =
        req.user.organizationId;

      const userId =
        req.user.userId;


      // =================================================
      // GENERATE STATE
      // =================================================

      const state =
        crypto
          .randomBytes(32)
          .toString("hex");


      // =================================================
      // STORE STATE
      // =================================================

      const {
        error,
      } = await supabase

        .from(
          "slack_oauth_states"
        )

        .insert({

          state,

          organization_id:
            organizationId,

          user_id:
            userId,

          expires_at:
            new Date(
              Date.now() +
              10 * 60 * 1000
            ).toISOString(),

        });


      if (error) {

        console.error(
          "OAuth state error:",
          error
        );


        return res.status(500).json({

          error:
            "Failed to initialize Slack connection.",

        });

      }


      // =================================================
      // BUILD SLACK URL
      // =================================================

      const params =
        new URLSearchParams({

          client_id:
            process.env.SLACK_CLIENT_ID,

          scope:
            [
              "commands",
              "chat:write",
              "users:read",
              "users:read.email",
            ].join(","),

          redirect_uri:
            process.env.SLACK_REDIRECT_URI,

          state,

        });


      const slackUrl =
        `https://slack.com/oauth/v2/authorize?${params.toString()}`;


      console.log(
        "Starting Slack OAuth:",
        {
          organizationId,
          userId,
        }
      );


      return res.json({

        url:
          slackUrl,

      });

    } catch (error) {

      console.error(
        "Slack connect error:",
        error
      );


      return res.status(500).json({

        error:
          "Failed to start Slack OAuth.",

      });

    }

  }

);


// =====================================================
// OAUTH CALLBACK
// =====================================================

router.get(

  "/callback",

  async (req, res) => {

    try {

      const {
        code,
        state,
        error,
      } = req.query;


      // =================================================
      // USER CANCELLED
      // =================================================

      if (error) {

        console.error(
          "Slack OAuth cancelled:",
          error
        );


        return res.redirect(

          `${process.env.FRONTEND_URL}/dashboard?slack=cancelled`

        );

      }


      if (
        !code ||
        !state
      ) {

        return res.status(400).send(
          "Invalid Slack OAuth request."
        );

      }


      // =================================================
      // LOOK UP STATE
      // =================================================

      const {
        data: oauthState,
        error: stateError,
      } = await supabase

        .from(
          "slack_oauth_states"
        )

        .select(`
          id,
          state,
          organization_id,
          user_id,
          expires_at
        `)

        .eq(
          "state",
          state
        )

        .maybeSingle();


      if (stateError) {

        console.error(
          "OAuth state lookup error:",
          stateError
        );


        return res.status(500).send(
          "Failed to validate OAuth state."
        );

      }


      if (!oauthState) {

        return res.status(400).send(
          "Invalid or expired OAuth state."
        );

      }


      // =================================================
      // CHECK EXPIRATION
      // =================================================

      if (
        new Date(
          oauthState.expires_at
        ) < new Date()
      ) {

        await supabase

          .from(
            "slack_oauth_states"
          )

          .delete()

          .eq(
            "id",
            oauthState.id
          );


        return res.status(400).send(
          "Slack authorization expired."
        );

      }


      // =================================================
      // EXCHANGE CODE
      // =================================================

      const tokenResponse =
        await fetch(

          "https://slack.com/api/oauth.v2.access",

          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/x-www-form-urlencoded",

            },

            body:

              new URLSearchParams({

                client_id:
                  process.env.SLACK_CLIENT_ID,

                client_secret:
                  process.env.SLACK_CLIENT_SECRET,

                code,

                redirect_uri:
                  process.env.SLACK_REDIRECT_URI,

              }),

          }

        );


      const slackData =
        await tokenResponse.json();


      if (
        !slackData.ok
      ) {

        console.error(
          "Slack OAuth exchange failed:",
          slackData
        );


        return res.status(400).send(
          "Slack authorization failed."
        );

      }


      // =================================================
      // SLACK DETAILS
      // =================================================

      const teamId =
        slackData.team?.id;

      const teamName =
        slackData.team?.name;

      const botToken =
        slackData.access_token;
      const installingUserSlackId =
        slackData.authed_user?.id;

      const botUserId =
        slackData.bot_user_id;


      if (
        !teamId ||
        !botToken ||
        !installingUserSlackId
      ) {

        return res.status(400).send(
          "Slack did not return workspace information."
        );

      }


      console.log(
        "Slack OAuth successful:",
        {
          teamId,
          teamName,
          organizationId:
            oauthState.organization_id,
        }
      );


      // =================================================
      // CHECK WHETHER WORKSPACE ALREADY CONNECTED
      // =================================================

      const {
        data: existingOrganization,
        error:
          existingOrganizationError,
      } = await supabase

        .from(
          "organizations"
        )

        .select(`
          id,
          name
        `)

        .eq(
          "slack_team_id",
          teamId
        )

        .maybeSingle();


      if (
        existingOrganizationError
      ) {

        console.error(
          "Existing workspace lookup:",
          existingOrganizationError
        );


        return res.status(500).send(
          "Failed to verify Slack workspace."
        );

      }


      if (
        existingOrganization &&
        existingOrganization.id !==
          oauthState.organization_id
      ) {

        console.error(
          "Slack workspace already connected:",
          {
            teamId,

            existingOrganization:
              existingOrganization.id,

            attemptedOrganization:
              oauthState.organization_id,

          }
        );


        await supabase

          .from(
            "slack_oauth_states"
          )

          .delete()

          .eq(
            "id",
            oauthState.id
          );


        return res.redirect(

          `${process.env.FRONTEND_URL}/dashboard?slack=already_connected`

        );

      }


      // =================================================
      // SAVE SLACK CONNECTION
      // =================================================

      const {
        error: updateError,
      } = await supabase

        .from(
          "organizations"
        )

        .update({

          slack_team_id:
            teamId,

          slack_bot_token:
            botToken,

          slack_bot_id:
            botUserId,

          slack_bot_user_id:
            botUserId,

        })

        .eq(
          "id",
          oauthState.organization_id
        );


      if (updateError) {

        console.error(
          "Organization Slack update:",
          updateError
        );


        return res.status(500).send(
          "Failed to save Slack connection."
        );

      }

      const {
        error: adminSlackUserError,
      } = await supabase
        .from("users")
        .update({
          slack_user_id:
            installingUserSlackId,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          oauthState.user_id
        )
        .eq(
          "organization_id",
          oauthState.organization_id
        );
        if (adminSlackUserError) {
          console.error(
            "Failed to map Slack user to admin:",
            adminSlackUserError
          );

          return res.status(500).send(
            "Slack connected, but failed to map the installing user."
          );
        }


      // =================================================
      // AUTOMATIC MEMBER SYNC
      // =================================================

      let syncResult = null;


      try {

        syncResult =
          await syncSlackMembers(

            oauthState.organization_id,

            botToken

          );


        console.log(
          "Initial Slack member sync completed:",
          syncResult
        );


      } catch (syncError) {

        /*
          IMPORTANT:

          Slack is already connected even if
          member sync fails.

          Admin can use:
          Dashboard → Sync Slack Members
        */

        console.error(
          "Initial Slack member sync failed:",
          syncError
        );

      }


      // =================================================
      // DELETE OAUTH STATE
      // =================================================

      await supabase

        .from(
          "slack_oauth_states"
        )

        .delete()

        .eq(
          "id",
          oauthState.id
        );


      // =================================================
      // REDIRECT
      // =================================================

      const query =
        syncResult

          ? `?slack=connected&synced=${syncResult.synced}&newUsers=${syncResult.newUsers}`

          : "?slack=connected&sync=failed";


      return res.redirect(

        `${process.env.FRONTEND_URL}/dashboard${query}`

      );

    } catch (error) {

      console.error(
        "Slack callback error:",
        error
      );


      return res.status(500).send(
        "Slack connection failed."
      );

    }

  }

);


// =====================================================
// SLACK STATUS
// =====================================================

router.get(

  "/status",

  authenticateToken,

  async (req, res) => {

    try {

      const {
        data,
        error,
      } = await supabase

        .from(
          "organizations"
        )

        .select(
          "slack_team_id"
        )

        .eq(
          "id",
          req.user.organizationId
        )

        .single();


      if (error) {

        return res.status(500).json({

          error:
            "Failed to get Slack status.",

        });

      }


      return res.json({

        connected:
          Boolean(
            data.slack_team_id
          ),

        teamId:
          data.slack_team_id,

      });

    } catch (error) {

      console.error(
        error
      );


      return res.status(500).json({

        error:
          "Internal server error.",

      });

    }

  }

);


// =====================================================
// MANUAL SYNC
// =====================================================

router.post(

  "/sync-members",

  authenticateToken,

  requireAdmin,

  async (req, res) => {

    try {

      const organizationId =
        req.user.organizationId;


      // =================================================
      // GET ORGANIZATION
      // =================================================

      const {
        data: organization,
        error,
      } = await supabase

        .from(
          "organizations"
        )

        .select(`
          id,
          slack_team_id,
          slack_bot_token
        `)

        .eq(
          "id",
          organizationId
        )

        .single();


      if (
        error ||
        !organization
      ) {

        return res.status(404).json({

          error:
            "Organization not found.",

        });

      }


      if (
        !organization.slack_team_id ||
        !organization.slack_bot_token
      ) {

        return res.status(400).json({

          error:
            "Slack is not connected.",

        });

      }


      // =================================================
      // SYNC
      // =================================================

      const result =
        await syncSlackMembers(

          organizationId,

          organization.slack_bot_token

        );


      return res.json({

        success:
          true,

        ...result,

      });

    } catch (error) {

      console.error(
        "Manual Slack sync error:",
        error
      );


      return res.status(500).json({

        error:
          "Failed to sync Slack members.",

      });

    }

  }

);


module.exports =
  router;