# Kudos --- Employee Recognition & Rewards Platform

Kudos is an employee recognition and rewards platform that lets
employees recognize teammates directly through Slack. Employees receive
a monthly allocation of points that can be given as kudos, while earned
points can be redeemed for a monetary reward.

> **Current scope:** This repository is an MVP/test-mode implementation.
> Razorpay is currently used in **Test Mode** for payout testing.

------------------------------------------------------------------------

## Problem

Employee recognition is often disconnected from the tools where teams
already work.

Common problems include:

-   Recognition requires switching between different applications.
-   Employees may forget to recognize teammates.
-   HR teams have to manually track reward allocations.
-   Reward balances and transaction history can become difficult to
    reconcile.
-   Converting recognition points into monetary rewards can require
    manual work.
-   Organizations should avoid directly collecting and storing
    employees' bank/UPI details.

Kudos brings recognition into Slack and connects it to an end-to-end
reward workflow.

------------------------------------------------------------------------

## Solution

The current MVP provides this flow:

``` text
Employee gives Kudos in Slack
            ↓
Points are transferred
            ↓
Recipient's received balance increases
            ↓
Admin initiates redemption
            ↓
Employee receives email
            ↓
Employee claims reward
            ↓
Employee provides UPI details
            ↓
Razorpay Test payout is created
            ↓
Razorpay sends webhook status
            ↓
Kudos updates redemption
            ↓
Employee receives transaction email
```

------------------------------------------------------------------------

## Features

### Slack Kudos

Employees can give points directly through Slack:

``` text
/kudos @employee 30
```

The backend validates the giver, receiver, available allocation, and
transaction before recording the kudos.

### Monthly Allocation

Each employee receives:

``` text
100 points / month
```

Unused allocation does not roll over.

### Two Balances

Each employee has two separate balances:

-   **Reward Balance** --- points available to give.
-   **Received Balance** --- points earned from teammates.

Example:

``` text
Reward Balance:   70
Received Balance: 30
```

### Point Conversion

Current conversion:

``` text
1 point = ₹10
```

Examples:

``` text
10 points  = ₹100
30 points  = ₹300
60 points  = ₹600
100 points = ₹1,000
```

### Admin Dashboard

The dashboard provides:

-   Organization details
-   Current user information
-   Slack connection status
-   Organization members
-   Reward balances
-   Received balances
-   Transaction history
-   Reward/redemption actions
-   Slack synchronization

### Reward Redemption

An admin can initiate a reward redemption for an employee from the
dashboard.

Example:

``` text
Points:       30
Conversion:   ₹10 / point
Amount:       ₹300
```

A redemption record is created before the payout flow begins.

### Email Claim Flow

The employee receives an email with a reward claim link.

The test flow is:

``` text
Email
  ↓
Claim Reward
  ↓
Enter UPI
  ↓
Submit
```

The current test implementation is designed so that Kudos does not need
to store the employee's financial details.

### Razorpay Test Payouts

The current implementation uses Razorpay Test Mode.

The test payout flow creates:

1.  Razorpay contact
2.  VPA/fund account
3.  Razorpay test payout

Example:

``` text
Amount: ₹60
Reference ID: Redemption UUID
Status: processing
```

### Webhook-based Status Tracking

Kudos uses Razorpay webhook events to update transaction status.

Supported payout lifecycle states include:

``` text
processing
processed
failed
reversed
```

Our redemption status is updated accordingly:

``` text
sent → claimed
sent → failed
claimed → failed (reversal)
```

Unknown provider statuses are retained as provider status information
rather than being treated as successful automatically.

### Transaction Emails

Employees receive an email when the transaction status changes.

During testing:

``` text
To:  employee@example.com
CC:  testdishank@gmail.com
```

Emails can communicate:

-   Processing
-   Successful
-   Failed
-   Reversed
-   Other provider status updates

Transaction emails include the reward amount, points, status, payout ID,
reference ID, and transaction date.

The actual UPI ID is not intended to be stored by Kudos.

------------------------------------------------------------------------

## Redemption Lifecycle

``` text
                    ┌─────────────┐
                    │   pending   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    sent     │
                    └──────┬──────┘
                           │
                    Razorpay payout
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
         processed       failed       reversed
             │             │             │
             ▼             └──────┬──────┘
          claimed                 ▼
                                failed
```

Provider status and application redemption status are tracked separately
so that the application can retain the payment provider's state.

------------------------------------------------------------------------

## Architecture

``` text
                    ┌──────────────────┐
                    │      Slack       │
                    │     /kudos       │
                    └────────┬─────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────┐
│                 Kudos Backend                   │
│                                                 │
│  Auth     Slack     Rewards     Redemptions     │
│    │        │          │             │          │
└────┼────────┼──────────┼─────────────┼──────────┘
     │        │          │             │
     │        │          │             ▼
     │        │          │      ┌──────────────┐
     │        │          │      │   Supabase   │
     │        │          │      │  PostgreSQL  │
     │        │          │      └──────────────┘
     │        │          │
     │        │          ▼
     │        │    Reward Redemption
     │        │          │
     │        │          ▼
     │        │      Email Service
     │        │          │
     │        │          ▼
     │        │      Employee
     │        │
     │        ▼
     │    Slack Users
     │
     ▼
 Authentication

Redemption
    │
    ▼
Claim Page
    │
    ▼
Razorpay Test
    │
    ▼
Payout
    │
    ▼
Webhook
    │
    ▼
Kudos Backend
    │
    ├── claimed
    ├── failed
    └── provider status
```

------------------------------------------------------------------------

## Technology Stack

### Frontend

-   React
-   Vite
-   React Router
-   Axios
-   CSS

### Backend

-   Node.js
-   Express
-   JWT
-   bcrypt
-   Nodemailer
-   Razorpay SDK/API

### Database

-   Supabase
-   PostgreSQL

### Integrations

-   Slack
-   Razorpay Test Mode
-   Gmail SMTP

------------------------------------------------------------------------

## Project Structure

``` text
kudos/
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── dashboard.js
│   │   │   ├── redemptions.js
│   │   │   ├── testClaims.js
│   │   │   └── razorpayWebhook.js
│   │   │
│   │   ├── services/
│   │   │   ├── razorpayTestService.js
│   │   │   ├── rewardEmailService.js
│   │   │   └── claimTokenService.js
│   │   │
│   │   ├── slack/
│   │   │   └── app.js
│   │   │
│   │   ├── db/
│   │   │   └── supabase.js
│   │   │
│   │   └── server.js
│   │
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   └── ClaimReward.jsx
│   │   │
│   │   ├── components/
│   │   │   ├── MembersTable.jsx
│   │   │   ├── GiftCardModal.jsx
│   │   │   ├── BalanceCard.jsx
│   │   │   ├── TransactionsTable.jsx
│   │   │   └── SlackControls.jsx
│   │   │
│   │   └── api/
│   │       └── client.js
│   │
│   └── package.json
│
└── README.md
```

------------------------------------------------------------------------

## Getting Started

### Prerequisites

Install:

-   Node.js
-   npm
-   Supabase project
-   Slack App
-   Razorpay Test Mode account
-   Gmail account with an App Password

### Backend

``` bash
cd backend
npm install
```

Create:

``` text
.env
```

Example configuration:

``` env
PORT=3000

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

JWT_SECRET=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_ACCOUNT_NUMBER=
RAZORPAY_WEBHOOK_SECRET=

EMAIL_USER=
EMAIL_PASSWORD=
REWARD_STATUS_CC_EMAIL=testdishank@gmail.com
```

Start the backend:

``` bash
npm run dev
```

### Frontend

``` bash
cd frontend
npm install
npm run dev
```

------------------------------------------------------------------------

## Environment Variables

Never commit real credentials.

Required backend configuration includes:

  -----------------------------------------------------------------------
  Variable                            Purpose
  ----------------------------------- -----------------------------------
  `PORT`                              Backend server port

  `SUPABASE_URL`                      Supabase project URL

  `SUPABASE_SERVICE_ROLE_KEY`         Supabase backend key

  `JWT_SECRET`                        JWT signing secret

  `RAZORPAY_KEY_ID`                   Razorpay Test Mode key

  `RAZORPAY_KEY_SECRET`               Razorpay Test Mode secret

  `RAZORPAY_ACCOUNT_NUMBER`           RazorpayX account identifier used
                                      by the test payout flow

  `RAZORPAY_WEBHOOK_SECRET`           Razorpay webhook verification
                                      secret

  `EMAIL_USER`                        Gmail SMTP account

  `EMAIL_PASSWORD`                    Gmail App Password

  `REWARD_STATUS_CC_EMAIL`            Test transaction email CC
  -----------------------------------------------------------------------

Recommended `.gitignore`:

``` gitignore
node_modules/
.env
.env.*
!.env.example
dist/
build/
```

------------------------------------------------------------------------

## Test Mode

This project is currently **not a production payment system**.

The payout integration is intentionally running in Razorpay Test Mode so
that the complete workflow can be tested without building the production
financial infrastructure.

Current test flow:

``` text
Admin
  ↓
Send Reward
  ↓
Redemption Created
  ↓
Email Sent
  ↓
Employee Claims
  ↓
UPI Provided
  ↓
Razorpay TEST Contact
  ↓
Razorpay TEST VPA
  ↓
Razorpay TEST Payout
  ↓
Webhook
  ↓
Transaction Status
  ↓
Status Email
```

------------------------------------------------------------------------

## Security Considerations

Never commit:

``` text
.env
Razorpay secrets
Supabase service-role keys
JWT secrets
Gmail passwords
Slack secrets
```

Use `.env.example` to document required configuration without exposing
credentials.

Kudos is designed so that employee financial information is not stored
unnecessarily in the application database.

------------------------------------------------------------------------

## Future Improvements

Potential future improvements include:

-   Automated monthly redemption batch
-   Configurable minimum redemption threshold
-   Configurable points-to-INR conversion rate
-   Configurable claim expiry
-   Expired reward handling/re-credit policy
-   Financial reconciliation dashboard
-   Transaction audit logs
-   Email delivery logs
-   Production Razorpay integration
-   Additional communication integrations
-   Advanced recognition analytics
-   Admin reporting
-   Automated monthly balance reset
-   More robust payout reconciliation

------------------------------------------------------------------------

## MVP Goal

Kudos aims to provide a simple end-to-end employee recognition
experience:

``` text
Recognize
   ↓
Earn Points
   ↓
Redeem
   ↓
Claim
   ↓
Pay
   ↓
Track
   ↓
Notify
```

The MVP connects employee recognition in Slack with reward redemption
and a test-mode payout workflow, giving organizations a single place to
manage recognition, balances, redemptions, and transaction status.
