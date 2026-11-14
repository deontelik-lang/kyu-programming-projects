/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that simulates ATM withdrawals using a while loop.
- Withdrawals are allowed while the balance is greater than 0
- The loop stops when the balance becomes zero or negative
- The balance is displayed after each withdrawal
*/

#include <stdio.h>

int main()
{
    float balance, amount;

    printf("Enter the account balance: ");
    scanf("%f", &balance);

    while (balance > 0)
    {
        printf("Enter the amount to withdraw: ");
        scanf("%f", &amount);

        balance = balance - amount;

        printf("Balance after withdrawal: %.2f\n", balance);
    }

    printf("The balance is zero or negative. No more withdrawals allowed.\n");

    return 0;
}
