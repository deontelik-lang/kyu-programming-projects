/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that calculates compound interest.
- Amount = principal x (1 + rate/100) ^ time
- Compound Interest = Amount - principal
- The user enters the principal amount, time (years) and rate (%)
- Compile with: gcc file.c -o file -lm
*/

#include <stdio.h>
#include <math.h>

int main()
{
    double principal, time, rate, amount, compound_interest;

    printf("Enter the principal amount: ");
    scanf("%lf", &principal);

    printf("Enter the time (in years): ");
    scanf("%lf", &time);

    printf("Enter the rate (%%): ");
    scanf("%lf", &rate);

    amount = principal * pow(1 + rate / 100, time);
    compound_interest = amount - principal;

    printf("Total Amount: %.2f\n", amount);
    printf("Compound Interest: %.2f\n", compound_interest);

    return 0;
}
