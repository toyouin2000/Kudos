const supabase =
  require("../db/supabase");


async function syncSlackMembers(
  organizationId,
  botToken
) {

  console.log(
    `Starting Slack member sync for organization ${organizationId}`
  );


  // ===================================================
  // GET SLACK USERS
  // ===================================================

  const response =
    await fetch(
      "https://slack.com/api/users.list",
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


  if (
    !slackData.ok
  ) {

    throw new Error(
      `Slack users.list failed: ${slackData.error}`
    );

  }


  const slackUsers =
    slackData.members || [];


  console.log(
    `Slack returned ${slackUsers.length} users`
  );


  let synced =
    0;

  let newUsers =
    0;

  let updatedUsers =
    0;

  let skippedUsers =
    0;


  // ===================================================
  // KEEP TRACK OF ACTIVE SLACK USERS
  // ===================================================

  const activeSlackUserIds =
    new Set();


  // ===================================================
  // PROCESS USERS
  // ===================================================

  for (
    const slackUser
    of slackUsers
  ) {

    // -------------------------------------------------
    // Ignore bots
    // -------------------------------------------------

    if (
      slackUser.is_bot ||
      slackUser.is_app_user
    ) {

      skippedUsers++;

      continue;

    }


    // -------------------------------------------------
    // Ignore deleted users
    // -------------------------------------------------

    if (
      slackUser.deleted
    ) {

      continue;

    }


    const slackUserId =
      slackUser.id;


    activeSlackUserIds.add(
      slackUserId
    );


    // -------------------------------------------------
    // NAME
    // -------------------------------------------------

    const name =
      slackUser.real_name ||
      slackUser.profile?.real_name ||
      slackUser.profile?.display_name ||
      slackUser.name ||
      "Slack User";


    // -------------------------------------------------
    // EMAIL
    // -------------------------------------------------

    const email =
      slackUser.profile?.email ||
      null;


    // =================================================
    // CHECK EXISTING USER
    // =================================================

    const {
      data: existingUser,
      error: lookupError,
    } = await supabase

      .from("users")

      .select(`
        id,
        name,
        email,
        slack_user_id,
        reward_balance,
        received_balance,
        is_active
      `)

      .eq(
        "organization_id",
        organizationId
      )

      .eq(
        "slack_user_id",
        slackUserId
      )

      .maybeSingle();


    if (lookupError) {

      console.error(
        "User lookup error:",
        lookupError
      );

      continue;

    }


    // =================================================
    // UPDATE EXISTING USER
    // =================================================

    if (existingUser) {

      const {
        error: updateError,
      } = await supabase

        .from("users")

        .update({

          name,

          email,

          is_active:
            true,

          updated_at:
            new Date().toISOString(),

        })

        .eq(
          "id",
          existingUser.id
        );


      if (updateError) {

        console.error(
          `Failed updating ${slackUserId}:`,
          updateError
        );

        continue;

      }


      updatedUsers++;

      synced++;

      continue;

    }


    // =================================================
    // CREATE NEW USER
    // =================================================

    const {
      error: insertError,
    } = await supabase

      .from("users")

      .insert({

        organization_id:
          organizationId,

        name,

        email,

        slack_user_id:
          slackUserId,

        reward_balance:
          100,

        received_balance:
          0,

        role:
          "employee",

        is_active:
          true,

        updated_at:
          new Date().toISOString(),

      });


    if (insertError) {

      console.error(
        `Failed inserting ${slackUserId}:`,
        insertError
      );

      continue;

    }


    newUsers++;

    synced++;

  }


  // ===================================================
  // DEACTIVATE USERS REMOVED FROM SLACK
  // ===================================================

  const {
    data: existingUsers,
    error:
      existingUsersError,
  } = await supabase

    .from("users")

    .select(`
      id,
      slack_user_id
    `)

    .eq(
      "organization_id",
      organizationId
    )

    .not(
      "slack_user_id",
      "is",
      null
    );


  if (!existingUsersError) {

    for (
      const user
      of existingUsers || []
    ) {

      if (
        !activeSlackUserIds.has(
          user.slack_user_id
        )
      ) {

        await supabase

          .from("users")

          .update({

            is_active:
              false,

            updated_at:
              new Date().toISOString(),

          })

          .eq(
            "id",
            user.id
          );

      }

    }

  }


  console.log(
    "Slack sync completed:",
    {
      synced,
      newUsers,
      updatedUsers,
      skippedUsers,
    }
  );


  return {

    synced,

    newUsers,

    updatedUsers,

    skippedUsers,

  };

}


module.exports =
  syncSlackMembers;