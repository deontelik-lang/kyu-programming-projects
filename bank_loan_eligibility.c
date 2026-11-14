/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that checks if a customer qualifies for a bank loan.
- The customer must be 21 years or over
- The annual income must be at least KSh 21,000
*/

#include <stdio.h>

int main()
{
    int age;
    double annual_income;

    printf("Enter your age: ");
    scanf("%d", &age);

    printf("Enter your annual income (in KSH): ");
    scanf("%lf", &annual_income);

    if (age >= 21 && annual_income >= 21000)
    {
        printf("Congratulations you qualify for a loan.\n");
    }
    else
    {
        printf("Unfortunately, we are unable to offer you a loan at this time.\n");
    }

    return 0;
}
