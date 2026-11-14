/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that calculates an employee's weekly salary.
- The user enters the hours worked and the hourly wage
- The calculateSalary() function multiplies hours by wage
- The weekly salary is returned to main() and displayed
- Weekly Salary = Hours Worked x Hourly Wage
*/

#include <stdio.h>

/* Function prototype */
float calculateSalary(float hours, float wage);

int main()
{
    float hours_worked, hourly_wage, weekly_salary;

    printf("Enter the hours worked: ");
    scanf("%f", &hours_worked);

    printf("Enter the hourly wage: ");
    scanf("%f", &hourly_wage);

    /* Call the function to calculate salary */
    weekly_salary = calculateSalary(hours_worked, hourly_wage);

    printf("Hours Worked: %.2f\n", hours_worked);
    printf("Hourly Wage: %.2f\n", hourly_wage);
    printf("Weekly Salary: %.2f\n", weekly_salary);

    return 0;
}

/* Function definition */
float calculateSalary(float hours, float wage)
{
    return hours * wage;
}
