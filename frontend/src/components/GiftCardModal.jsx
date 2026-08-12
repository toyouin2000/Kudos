import { useState } from "react";

import { sendGiftCard } from "../api/client";


function GiftCardModal({
  user,
  onClose,
  onSuccess,
}) {

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  // =====================================================
  // CURRENT BALANCE
  // =====================================================

  const points =
    Number(
      user?.received_balance || 0
    );


  // Current configured conversion rate
  // 1 point = ₹10
  const amount =
    points * 10;


  // =====================================================
  // SEND PAYOUT
  // =====================================================

  async function redeem() {

    setError("");


    // ===============================================
    // VALIDATE BALANCE
    // ===============================================

    if (points <= 0) {

      setError(
        "This user has no redeemable points."
      );

      return;

    }


    // ===============================================
    // START
    // ===============================================

    setLoading(true);


    try {

      // =============================================
      // CREATE PAYOUT LINK
      // =============================================

      const result =
        await sendGiftCard(
          user.id
        );


      console.log(
        "Payout response:",
        result
      );


      // =============================================
      // BELOW MINIMUM
      // =============================================

      if (
        result.eligible === false
      ) {

        setError(

          `The redemption amount is ₹${Number(
            result.amountInr
          ).toLocaleString(
            "en-IN"
          )}. Minimum redemption is ₹${Number(
            result.minimumRedemptionInr
          ).toLocaleString(
            "en-IN"
          )}.`

        );

        return;

      }


      // =============================================
      // SUCCESS
      // =============================================

      if (
        result.success
      ) {

        onSuccess(
          result
        );

        return;

      }


      // =============================================
      // UNEXPECTED RESPONSE
      // =============================================

      setError(
        "Unable to create the payout link."
      );


    } catch (error) {

      console.error(
        "Gift card redemption error:",
        error
      );


      const responseData =
        error.response?.data;


      const errorCode =
        responseData?.error;


      // =============================================
      // NO BALANCE
      // =============================================

      if (
        errorCode ===
        "NO_REDEEMABLE_BALANCE"
      ) {

        setError(
          "This user has no redeemable points."
        );

        return;

      }


      // =============================================
      // BELOW THRESHOLD
      // =============================================

      if (
        errorCode ===
        "BELOW_MINIMUM_REDEMPTION"
      ) {

        const amountInr =
          responseData?.amountInr;

        const minimumInr =
          responseData?.minimumRedemptionInr;


        setError(

          `The redemption amount is ₹${Number(
            amountInr || 0
          ).toLocaleString(
            "en-IN"
          )}. Minimum redemption is ₹${Number(
            minimumInr || 0
          ).toLocaleString(
            "en-IN"
          )}.`

        );

        return;

      }


      // =============================================
      // EXISTING REDEMPTION
      // =============================================

      if (
        errorCode ===
        "REDEMPTION_ALREADY_EXISTS"
      ) {

        setError(
          "A redemption for this user already exists for this month."
        );

        return;

      }


      // =============================================
      // GENERIC ERROR
      // =============================================

      setError(

        responseData?.message ||
        responseData?.error ||
        "Gift card redemption failed."

      );

    } finally {

      setLoading(false);

    }

  }


  // =====================================================
  // MODAL
  // =====================================================

  return (

    <div
      className="modal-overlay"
      onClick={
        onClose
      }
    >

      <div

        className="gift-modal"

        onClick={(event) =>
          event.stopPropagation()
        }

      >

        {/* =============================================
            HEADER
        ============================================== */}

        <div className="modal-header">

          <div>

            <h2>
              Send Amazon Gift Card
            </h2>

            <p>

              Send payout to{" "}

              <strong>
                {user.name}
              </strong>

            </p>

          </div>


          <button

            className="modal-close"

            onClick={
              onClose
            }

            disabled={
              loading
            }

          >

            ×

          </button>

        </div>


        {/* =============================================
            RECIPIENT
        ============================================== */}

        <div className="recipient-email">

          <span>
            Recipient
          </span>

          <strong>
            {user.email ||
              "No email configured"}
          </strong>

        </div>


        {/* =============================================
            CONVERSION
        ============================================== */}

        <div className="conversion-info">

          <span>
            Conversion
          </span>

          <strong>
            1 point = ₹10
          </strong>

        </div>


        {/* =============================================
            POINTS
        ============================================== */}

        <div className="available-points">

          <span>
            Earned this month
          </span>

          <strong>

            {points}

            {" "}

            points

          </strong>

        </div>


        {/* =============================================
            PAYOUT VALUE
        ============================================== */}

        <div className="redemption-value">

          <span>
            Payout value
          </span>

          <strong>

            ₹
            {amount.toLocaleString(
              "en-IN"
            )}

          </strong>

        </div>


        {/* =============================================
            INFO
        ============================================== */}

        <div className="payout-info">

          <p>

            The employee will receive a secure
            payout link by email.

          </p>

          <p>

            They will enter their own UPI or
            bank details on the payment provider's
            hosted page.

          </p>

          <p>

            Kudos never stores their bank
            account or UPI details.

          </p>

        </div>


        {/* =============================================
            ERROR
        ============================================== */}

        {error && (

          <div className="modal-error">

            {error}

          </div>

        )}


        {/* =============================================
            ACTIONS
        ============================================== */}

        <div className="modal-actions">

          <button

            className="secondary-button"

            onClick={
              onClose
            }

            disabled={
              loading
            }

          >

            Cancel

          </button>


          <button

            className="primary-button"

            onClick={
              redeem
            }

            disabled={
              loading ||
              points <= 0
            }

          >

            {loading
              ? "Creating payout..."
              : "Confirm & Send"}

          </button>

        </div>

      </div>

    </div>

  );

}


export default GiftCardModal;