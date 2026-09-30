/**
 * A link that opens the Messages app with the customer's number and this text filled in,
 * so all that's left is pressing send. The "?&body=" form works on iPhone and Mac.
 */
export function smsLink(phone: string, body: string): string {
  const number = phone.replace(/[^\d+]/g, "");
  return `sms:${number}?&body=${encodeURIComponent(body)}`;
}
