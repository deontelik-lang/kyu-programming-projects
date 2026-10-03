/*Name: Brayan kihanga
 Reg:  CT100/G/30673/26*/
 #include <stdio.h>

// Function Prototype
float calculateTax(float gross_salary);

int main()
{
    float gross_salary, tax, net_salary;

    printf("Enter Gross Salary:\t");
    scanf("%f", &gross_salary);

    // Function Call
    tax = calculateTax(gross_salary);

    net_salary = gross_salary - tax;

    printf("\n");
    printf("EMPLOYEE SALARY PROGRAM\n");
    printf("========================\n");
    printf("Gross Salary: KSh %.2f\n", gross_salary);
    printf("Tax Amount: KSh %.2f\n", tax);
    printf("Net Salary: KSh %.2f\n", net_salary);
    printf("========================\n");

    return 0;
}

// Function Definition
float calculateTax(float gross_salary)
{
    float tax;

    if (gross_salary < 30000)
    {
        tax = 0.05 * gross_salary;
    }
    else if (gross_salary >= 30000 && gross_salary <= 59999)
    {
        tax = 0.10 * gross_salary;
    }
    else
    {
        tax = 0.15 * gross_salary;
    }

    return tax;
}
