/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program to calculate a customer's electricity bill.
The program uses a function calculateBill()
that accepts the number of units consumed
and the cost per unit, then returns the total bill.
*/
#include <stdio.h>

// Function Prototype
float calculateBill(float units, float costPerUnit);

int main()
{
    float units, costPerUnit, totalBill;

    printf("Enter the number of units consumed: ");
    scanf("%f", &units);

    printf("Enter the cost per unit: ");
    scanf("%f", &costPerUnit);

    totalBill = calculateBill(units, costPerUnit);

    printf("Total Electricity Bill = %.2f\n", totalBill);


}

//Function Definition
float calculateBill(float units, float costPerUnit)
{
    return units * costPerUnit;
}
