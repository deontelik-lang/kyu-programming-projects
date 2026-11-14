/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that calculates a customer's monthly electricity bill.
- First 50 units = KSh 10 per unit
- Next 100 units = KSh 15 per unit
- Units above 150 = KSh 20 per unit
- A 10% tax is charged on the energy charge
- The program displays the units consumed, energy charge, tax and total bill
*/

#include <stdio.h>

/* Function prototypes */
float calculateEnergyCharge(float units);
float calculateTax(float energy_charge);
float calculateTotalBill(float energy_charge, float tax);

int main()
{
    float units, energy_charge, tax, total_bill;

    printf("Enter the number of units consumed: ");
    scanf("%f", &units);

    /* Call the functions */
    energy_charge = calculateEnergyCharge(units);
    tax = calculateTax(energy_charge);
    total_bill = calculateTotalBill(energy_charge, tax);

    printf("Units Consumed: %.2f\n", units);
    printf("Energy Charge: %.2f KSH\n", energy_charge);
    printf("Tax: %.2f KSH\n", tax);
    printf("Total Bill: %.2f KSH\n", total_bill);

    return 0;
}

/* Function to calculate the energy charge */
float calculateEnergyCharge(float units)
{
    float charge;

    if (units <= 50)
    {
        charge = units * 10;
    }
    else if (units <= 150)
    {
        charge = (50 * 10) + ((units - 50) * 15);
    }
    else
    {
        charge = (50 * 10) + (100 * 15) + ((units - 150) * 20);
    }

    return charge;
}

/* Function to calculate the 10% tax */
float calculateTax(float energy_charge)
{
    return energy_charge * 0.10;
}

/* Function to calculate the total bill */
float calculateTotalBill(float energy_charge, float tax)
{
    return energy_charge + tax;
}
