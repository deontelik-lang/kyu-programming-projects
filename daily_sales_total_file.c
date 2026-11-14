/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that calculates the total daily sales from a file.
- Reads every transaction amount from sales.txt
- Calculates and displays the total sales for the day
- The file is closed after reading
*/

#include <stdio.h>

int main()
{
    FILE *fp;
    double amount, total = 0;

    fp = fopen("sales.txt", "r");
    if (fp == NULL)
    {
        printf("Error: could not open sales.txt.\n");
        return 1;
    }

    while (fscanf(fp, "%lf", &amount) == 1)
    {
        total = total + amount;
    }

    fclose(fp);

    printf("Total sales for the day: %.2f\n", total);

    return 0;
}
