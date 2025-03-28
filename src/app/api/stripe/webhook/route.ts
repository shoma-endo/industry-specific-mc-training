import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { userService } from '@/server/services/userService';
import { userRepository } from '@/server/services/userRepository';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature') || '';

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription as string;

        if (userId && subscriptionId) {
          await userService.updateStripeSubscriptionId(userId, subscriptionId);
          console.log(`Subscription ${subscriptionId} associated with user ${userId}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        const user = await userRepository.findByStripeCustomerId(customerId);
        if (user) {
          await userService.updateStripeSubscriptionId(user.lineUserId, subscription.id);
          console.log(`Subscription ${subscription.id} updated for user ${user.lineUserId}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        const user = await userRepository.findByStripeCustomerId(customerId);
        if (user) {
          await userService.updateStripeSubscriptionId(user.lineUserId, '');
          console.log(`Subscription removed for user ${user.lineUserId}`);
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
