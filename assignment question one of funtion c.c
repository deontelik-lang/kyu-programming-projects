/*Name: Brayan kihanga
  REG:CT100/G/30673/26.
  */
  //Assignment question 1 of function c

  #include<stdio.h>
#include <stdio.h>

// Function Prototype
float calculateBill(int units);

int main()
{
    int units;
    float bill;

    printf("Enter the number of units consumed:\t");
    scanf("%d", &units);

    // Function Call
    bill = calculateBill(units);

    printf("\n");
    printf("ELECTRICITY BILL PROGRAM\n");
    printf("========================\n");
    printf("Units Consumed: %d\n", units);
    printf("Total Electricity Bill: KSh %.2f\n", bill);
    printf("========================\n");

    return 0;
}

// Function Definition
float calculateBill(int units)
{
    float bill;

    if (units <= 100)
    {
        bill = units * 10;
    }
    else if (units <= 200)
    {
        bill = (100 * 10) + ((units - 100) * 15);
    }
    else
    {
        bill = (100 * 10) + (100 * 15) + ((units - 200) * 20);
    }

    return bill;
}
