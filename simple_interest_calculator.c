/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that calculates simple interest.
- Simple Interest = (principal amount x time x rate) / 100
- The user enters the principal amount, time (years) and rate (%)
*/

#include <stdio.h>

int main()
{
    double principal, time, rate, simple_interest;

    printf("Enter the principal amount: ");
    scanf("%lf", &principal);

    printf("Enter the time (in years): ");
    scanf("%lf", &time);

    printf("Enter the rate (%%): ");
    scanf("%lf", &rate);

    simple_interest = (principal * time * rate) / 100;

    printf("Simple Interest: %.2f\n", simple_interest);

    return 0;
}
