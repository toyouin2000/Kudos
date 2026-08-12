const express =
  require("express");

const supabase =
  require("../db/supabase");

const authenticateToken =
  require("../middleware/auth");


const router =
  express.Router();


router.get(

  "/",

  authenticateToken,

  async (req, res) => {

    try {

      const organizationId =
        req.user.organizationId;

      const userId =
        req.user.userId;


      // =================================================
      // ORGANIZATION
      // =================================================

      const {
        data: organization,
        error:
          organizationError,
      } = await supabase

        .from(
          "organizations"
        )

        .select(`
          id,
          name,
          email,
          monthly_points,
          slack_team_id
        `)

        .eq(
          "id",
          organizationId
        )

        .single();


      if (organizationError) {

        console.error(
          organizationError
        );

        return res.status(500).json({

          error:
            "Failed to fetch organization.",

        });

      }


      // =================================================
      // CURRENT USER
      // =================================================

      const {
        data: currentUser,
        error:
          currentUserError,
      } = await supabase

        .from(
          "users"
        )

        .select(`
          id,
          name,
          email,
          role,
          reward_balance,
          received_balance,
          slack_user_id
        `)

        .eq(
          "id",
          userId
        )

        .eq(
          "organization_id",
          organizationId
        )

        .single();


      if (currentUserError) {

        console.error(
          currentUserError
        );

        return res.status(500).json({

          error:
            "Failed to fetch current user.",

        });

      }


      // =================================================
      // USERS
      // =================================================

      const {
        data: users,
        error:
          usersError,
      } = await supabase

        .from(
          "users"
        )

        .select(`
          id,
          name,
          email,
          role,
          reward_balance,
          received_balance,
          slack_user_id,
          is_active
        `)

        .eq(
          "organization_id",
          organizationId
        )

        .eq(
          "is_active",
          true
        )

        .order(
          "name",
          {
            ascending:
              true,
          }
        );


      if (usersError) {

        console.error(
          usersError
        );

        return res.status(500).json({

          error:
            "Failed to fetch users.",

        });

      }


      // =================================================
      // TRANSACTIONS
      // =================================================

      const {
        data: transactions,
        error:
          transactionsError,
      } = await supabase

        .from(
          "kudos_transactions"
        )

        .select(`
          id,
          points,
          message,
          created_at,

          sender:sender_id (
            id,
            name
          ),

          receiver:receiver_id (
            id,
            name
          )
        `)

        .eq(
          "organization_id",
          organizationId
        )

        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )

        .limit(
          100
        );


      if (transactionsError) {

        console.error(
          transactionsError
        );

        return res.status(500).json({

          error:
            "Failed to fetch transactions.",

        });

      }


      return res.json({

        organization: {

          id:
            organization.id,

          name:
            organization.name,

          email:
            organization.email,

          monthlyPoints:
            organization.monthly_points,

          slackConnected:
            Boolean(
              organization.slack_team_id
            ),

          slackTeamId:
            organization.slack_team_id,

        },

        currentUser,

        users:
          users || [],

        transactions:
          transactions || [],

      });


    } catch (error) {

      console.error(
        "Dashboard error:",
        error
      );

      return res.status(500).json({

        error:
          "Internal server error.",

      });

    }

  }

);


module.exports =
  router;