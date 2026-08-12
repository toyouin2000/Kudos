const cron =
  require("node-cron");

const supabase =
  require("../db/supabase");


function startMonthlyResetJob() {

  /*
    Runs at 00:05 on the first day
    of every month.

    Server timezone should be Asia/Kolkata.
  */

  cron.schedule(
    "5 0 1 * *",
    async () => {

      console.log(
        "Running monthly reward balance reset..."
      );


      try {

        const {
          data,
          error,
        } = await supabase.rpc(
          "reset_monthly_reward_balances"
        );


        if (error) {

          console.error(
            "Monthly reset failed:",
            error
          );

          return;

        }


        console.log(
          `Monthly reset completed. Updated ${data} users.`
        );


      } catch (error) {

        console.error(
          "Monthly reset error:",
          error
        );

      }

    },
    {
      timezone:
        "Asia/Kolkata",
    }
  );


  console.log(
    "Monthly reward reset job scheduled."
  );

}


module.exports =
  startMonthlyResetJob;