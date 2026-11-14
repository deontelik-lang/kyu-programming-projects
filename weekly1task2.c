/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that collects a user's details and displays them back.
- The user enters their height in meters
- The user enters their bank balance in Kenya shillings
- The user enters their phone number
- The program displays all the values in a clear, formatted manner
*/

#include <stdio.h>

int main()
{
    float height;
    double bank_balance;
    char phone_number[15];

    /* Collect the user's details */
    printf("Enter your height (in meters): ");
    scanf("%f", &height);

    printf("Enter your bank balance (in KSH): ");
    scanf("%lf", &bank_balance);

    printf("Enter your phone number: ");
    scanf("%14s", phone_number);

    /* Display the details back to the user */
    printf("---- YOUR DETAILS -----\n");
    printf("Height: %.2f m\n", height);
    printf("Bank Balance: KSH %.2f\n", bank_balance);
    printf("Phone Number: %s\n", phone_number);

    return 0;
}
