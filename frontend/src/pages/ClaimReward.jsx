import {
  useEffect,
  useState
} from "react";

import {
  useParams
} from "react-router-dom";

import client from "../api/client";

import "../ClaimReward.css";


function ClaimReward() {

  const {
    token
  } = useParams();


  const [
    redemption,
    setRedemption
  ] = useState(null);


  const [
    upiId,
    setUpiId
  ] = useState("");


  const [
    loading,
    setLoading
  ] = useState(true);


  const [
    claiming,
    setClaiming
  ] = useState(false);


  const [
    error,
    setError
  ] = useState("");


  const [
    success,
    setSuccess
  ] = useState(null);


  // ===================================================
  // LOAD REWARD
  // ===================================================

  useEffect(() => {

    loadReward();

  }, [token]);


  async function loadReward() {

    try {

      setLoading(true);

      setError("");


      const response =
        await client.get(
          `/test-claims/${token}`
        );


      setRedemption(
        response.data.redemption
      );

    } catch (error) {

      console.error(
        error
      );


      setError(

        error.response?.data?.message ||

        "This reward link is invalid or expired."

      );

    } finally {

      setLoading(false);

    }

  }


  // ===================================================
  // CLAIM
  // ===================================================

  async function handleClaim(
    event
  ) {

    event.preventDefault();


    setError("");


    const normalizedUpi =
      upiId
        .trim()
        .toLowerCase();


    if (!normalizedUpi) {

      setError(
        "Enter your UPI ID."
      );

      return;

    }


    setClaiming(true);


    try {

      const response =
        await client.post(

          `/test-claims/${token}/claim`,

          {

            upiId:
              normalizedUpi

          }

        );


      setSuccess(
        response.data
      );


    } catch (error) {

      console.error(
        error
      );


      setError(

        error.response?.data?.message ||

        "Unable to process your reward."

      );

    } finally {

      setClaiming(false);

    }

  }


  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {

    return (

      <div className="claim-page">

        <div className="claim-card">

          <p>
            Loading your reward...
          </p>

        </div>

      </div>

    );

  }


  // ===================================================
  // ERROR
  // ===================================================

  if (
    error &&
    !redemption
  ) {

    return (

      <div className="claim-page">

        <div className="claim-card">

          <div className="claim-brand">
            Kudos
          </div>

          <h1>
            Reward unavailable
          </h1>

          <p className="claim-error">
            {error}
          </p>

        </div>

      </div>

    );

  }


  // ===================================================
  // SUCCESS
  // ===================================================

  if (success) {

    return (

      <div className="claim-page">

        <div className="claim-card">

          <div className="success-icon">
            ✓
          </div>

          <div className="claim-brand">
            Kudos
          </div>

          <h1>
            Reward claimed
          </h1>

          <p>

            Your Razorpay Test Mode payout
            has been created successfully.

          </p>


          <div className="claim-amount">

            ₹
            {Number(
              success
                .redemption
                .amountInr
            ).toLocaleString(
              "en-IN"
            )}

          </div>


          <div className="claim-status">

            Status:

            {" "}

            <strong>
              {
                success
                  .payout
                  .status
              }
            </strong>

          </div>


          <div className="test-notice">

            This is a Razorpay Test Mode
            transaction. No real money has
            been transferred.

          </div>

        </div>

      </div>

    );

  }


  // ===================================================
  // MAIN
  // ===================================================

  return (

    <div className="claim-page">

      <div className="claim-card">

        <div className="claim-brand">
          Kudos
        </div>


        <h1>
          Claim your reward
        </h1>


        <p className="claim-subtitle">

          Hi{" "}

          <strong>
            {redemption.recipientName}
          </strong>

          , your Kudos reward is ready.

        </p>


        <div className="claim-amount">

          ₹
          {Number(
            redemption.amountInr
          ).toLocaleString(
            "en-IN"
          )}

        </div>


        <div className="claim-points">

          {redemption.points}

          {" "}

          Kudos points

        </div>


        <form
          onSubmit={
            handleClaim
          }
        >

          <label>
            UPI ID
          </label>


          <input

            type="text"

            placeholder="yourname@upi"

            value={
              upiId
            }

            onChange={(event) =>
              setUpiId(
                event.target.value
              )
            }

            autoComplete="off"

            required

          />


          <p className="input-help">

            Enter the UPI ID where you want
            the test payout sent.

          </p>


          {error && (

            <div className="claim-error">

              {error}

            </div>

          )}


          <button

            type="submit"

            disabled={
              claiming
            }

          >

            {claiming

              ? "Processing..."

              : "Claim Reward"

            }

          </button>

        </form>


        <div className="test-notice">

          <strong>
            Test Mode
          </strong>

          <br />

          This is a Razorpay Test Mode
          transaction. No real money will
          be transferred.

        </div>

      </div>

    </div>

  );

}


export default ClaimReward;