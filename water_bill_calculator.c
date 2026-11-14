/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that calculates a customer's water bill.
- 0 to 30 units = 20 KES per unit
- 31 to 60 units = 25 KES per unit
- Above 60 units = 30 KES per unit
- Charges are applied per band (each band is charged at its own rate)
*/

#include <stdio.h>

int main()
{
    float units, bill;

    printf("Enter water units consumed: ");
    scanf("%f", &units);

    if (units <= 30)
    {
        bill = units * 20;
    }
    else if (units <= 60)
    {
        bill = (30 * 20) + ((units - 30) * 25);
    }
    else
    {
        bill = (30 * 20) + (30 * 25) + ((units - 60) * 30);
    }

    printf("Total water bill: %.2f KES\n", bill);

    return 0;
}
