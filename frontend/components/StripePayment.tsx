"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { paymentsAPI } from "@/lib/api";
import toast from "react-hot-toast";

// Initialize Stripe
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
);

interface StripePaymentFormProps {
  saleId: number;
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

// Stripe Payment Form Component
function StripePaymentForm({
  saleId,
  amount,
  onSuccess,
  onCancel,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      console.log("Starting payment submission...");

      // Create payment method
      console.log("Submitting elements...");
      const { error: submitError } = await elements.submit();
      if (submitError) {
        console.error("Submit error:", submitError);
        throw new Error(submitError.message);
      }

      // Get payment method
      console.log("Creating payment method...");
      const { error: paymentMethodError, paymentMethod } =
        await stripe.createPaymentMethod({
          elements,
        });

      if (paymentMethodError) {
        console.error("Payment method error:", paymentMethodError);
        throw new Error(paymentMethodError.message);
      }

      console.log("Payment method created:", paymentMethod.id);

      // Process payment through backend
      console.log("Sending to backend...");
      const response = await paymentsAPI.processStripe({
        sale_id: saleId,
        amount,
        payment_method_id: paymentMethod.id,
      });
      console.log("Backend response:", response);
      console.log("Response data:", response.data);
      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);

      if (!response.data) {
        throw new Error(
          "Empty response from backend. Backend may not be running.",
        );
      }

      // Confirm payment if needed
      if (
        response.data &&
        "client_secret" in response.data &&
        response.data.client_secret
      ) {
        const { error: confirmError } = await stripe.confirmPayment({
          clientSecret: response.data.client_secret as string,
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/pos`,
          },
          redirect: "if_required",
        });

        if (confirmError) {
          throw new Error(confirmError.message);
        }
      }

      toast.success("Payment successful!");
      onSuccess();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Payment error:", error);
      console.error("Error response:", error.response?.data);
      const errorMessage =
        error?.response?.data?.error || error.message || "Payment failed";
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 bg-gray-50 rounded-lg">
        <PaymentElement />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 btn btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 btn btn-primary"
        >
          {isProcessing ? "Processing..." : `Pay $${amount.toFixed(2)}`}
        </button>
      </div>
    </form>
  );
}

// Main Stripe Payment Component
interface StripePaymentProps {
  saleId: number;
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function StripePayment({
  saleId,
  amount,
  onSuccess,
  onCancel,
}: StripePaymentProps) {
  const options = {
    mode: "payment" as const,
    amount: Math.round(amount * 100), // Convert to cents
    currency: "usd",
    appearance: {
      theme: "stripe" as const,
    },
    paymentMethodCreation: "manual" as const,
  };

  return (
    <div className="bg-white rounded-lg p-6">
      <h3 className="text-lg font-bold mb-4">Card Payment</h3>
      <p className="text-sm text-gray-600 mb-4">
        Total Amount:{" "}
        <span className="font-bold text-lg">${amount.toFixed(2)}</span>
      </p>

      <Elements stripe={stripePromise} options={options}>
        <StripePaymentForm
          saleId={saleId}
          amount={amount}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      </Elements>
    </div>
  );
}
