/* Name: Brayan Kihanga
   Reg: CT100/30673/26
*/

// Weekly Assignment one No. 2

#include <stdio.h>

int main()
{
    // Declare variables
    float heightInMeters;          // %f
    float bankBalance;             // %f
    char phoneNumber[15];          // %s

    printf("Enter your height in meters: ");
    scanf("%f", &heightInMeters);

    printf("Enter your bank balance in Kenyan shillings: ");
    scanf("%f", &bankBalance);

    printf("Enter your phone number: ");
    scanf("%s", phoneNumber);

    printf("\n--- Details Entered ---\n");
    printf("Height: %.2f meters\n", heightInMeters);
    printf("Bank Balance: KSh %.2f\n", bankBalance);
    printf("Phone Number: %s\n", phoneNumber);

    return 0;
}
