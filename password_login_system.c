/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A password system using a do while loop.
- The user is prompted until the correct password (1234) is entered
- The program then displays Access Granted
*/

#include <stdio.h>
#include <string.h>

int main()
{
    char password[50];

    do
    {
        printf("Enter the password: ");
        scanf("%49s", password);
    } while (strcmp(password, "1234") != 0);

    printf("Access Granted\n");

    return 0;
}
