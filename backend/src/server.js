require("dotenv").config();


const express =
  require("express");



const cors =
  require("cors");
// const razorpayWebhook =
//   require("./routes/razorpayWebhook");

// app.use(
//   "/api/webhooks",
//   express.raw({
//     type:
//       "application/json",
//   }),
//   razorpayWebhook
// );


const authRoutes =
  require("./routes/auth");

const slackRoutes =
  require("./routes/slack");

const dashboardRoutes =
  require("./routes/dashboard");

const giftCardRoutes =
  require("./routes/giftCards");

// const redemptionRoutes =
//   require("./routes/redemptions");

const {
  startSlack,
} =
  require("./slack/app");

const redemptionsRouter =
  require("./routes/redemptions");

const testClaimsRouter =
  require("./routes/testClaims");

const startMonthlyResetJob =
  require("./jobs/monthlyReset");


const app =
  express();


app.use(

  cors({

    origin:
      process.env.FRONTEND_URL,

    credentials:
      true,

  })

);


app.use(
  express.json()
);


// =====================================================
// HEALTH
// =====================================================

app.get(
  "/health",
  (req, res) => {

    res.json({

      status:
        "ok",

    });

  }
);


// =====================================================
// ROUTES
// =====================================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/slack",
  slackRoutes
);

app.use(
  "/api/dashboard",
  dashboardRoutes
);

app.use(
  "/api/gift-cards",
  giftCardRoutes
);

app.use(
  "/api/redemptions",
  redemptionsRouter
);

app.use(
  "/api/test-claims",
  testClaimsRouter
);

// app.use(
//   "/api/redemptions",
//   redemptionRoutes
// );

app.use(
  "/api/webhooks/razorpay",
  express.raw({
    type:
      "application/json",
  })
);



// =====================================================
// SERVER
// =====================================================

const PORT =
  process.env.PORT ||
  3000;


async function startServer() {

  app.listen(
    PORT,
    async () => {

      console.log(
        `Backend running on port ${PORT}`
      );


      try {

        await startSlack();

      } catch (error) {

        console.error(
          "Slack startup failed:",
          error
        );

      }


      try {

        startMonthlyResetJob();

      } catch (error) {

        console.error(
          "Monthly reset startup failed:",
          error
        );

      }

    }
  );

}


startServer();