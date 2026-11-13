/*
Name  : BRAYAN KIHANGA
REG NO:CT100/G/30673/26
DATE   :14/11/26
DESCRIPTION:DISCOUNT;
            amount<1000,no discount
            amount between 1000 and 5000; 5%discount
            greater than 5000, 10% discount
*/
 #include<stdio.h>
 int main()
 {
     float amount,discount,amount_payable;
     printf("Enter purchase amount : \t");
     scanf("%f",&amount);
     if (amount>5000){
        discount=0.01 *amount;
     }
     else if(amount>=1000&&amount<=5000){
        discount=0.005 *amount;
     }
     else {discount=0 *amount;
     }
     amount_payable=amount-discount;
     printf("The discount is ksh %.2f\n",discount);
     printf("The amount before discount is ksh %.2f\n",amount);
     printf("The amount after discount is ksh %.2f\n",amount_payable);
     return 0;
 }
